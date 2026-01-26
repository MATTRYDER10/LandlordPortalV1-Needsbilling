<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto"
    @click.self="handleClose"
  >
    <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="handleClose"></div>

      <!-- Modal panel -->
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <form @submit.prevent="handleSubmit">
          <div class="bg-white px-6 pt-6 pb-4">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-xl font-semibold text-gray-900">Upload Document</h3>
              <button
                type="button"
                @click="handleClose"
                class="text-gray-400 hover:text-gray-600"
              >
                <X class="h-6 w-6" />
              </button>
            </div>

            <div class="space-y-4">
              <!-- Document Tag -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Document Type <span class="text-red-500">*</span>
                </label>
                <select
                  v-model="form.tag"
                  required
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select type...</option>
                  <option value="gas">Gas Safety Certificate</option>
                  <option value="epc">EPC Certificate</option>
                  <option value="agreement">Tenancy Agreement</option>
                  <option value="inventory">Inventory</option>
                  <option value="reference">Reference</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <!-- File Upload -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  File <span class="text-red-500">*</span>
                </label>
                <div
                  class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors"
                  :class="{ 'border-primary bg-primary/5': isDragging }"
                  @dragover.prevent="isDragging = true"
                  @dragleave="isDragging = false"
                  @drop.prevent="handleFileDrop"
                >
                  <div v-if="!selectedFile">
                    <Upload class="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p class="text-sm text-gray-600 mb-2">Drag and drop your file here, or</p>
                    <label class="inline-block px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-md cursor-pointer hover:bg-primary/20">
                      Browse Files
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        class="hidden"
                        @change="handleFileSelect"
                      />
                    </label>
                    <p class="text-xs text-gray-500 mt-3">PDF, JPG, PNG, DOC up to 25MB</p>
                  </div>
                  <div v-else class="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div class="flex items-center gap-3">
                      <FileText class="h-8 w-8 text-gray-400" />
                      <div class="text-left">
                        <p class="text-sm font-medium text-gray-900">{{ selectedFile.name }}</p>
                        <p class="text-xs text-gray-500">{{ formatFileSize(selectedFile.size) }}</p>
                      </div>
                    </div>
                    <button type="button" @click="selectedFile = null" class="text-red-500 hover:text-red-700 p-1">
                      <X class="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- File Name Override (optional) -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Custom Name <span class="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  v-model="form.customName"
                  :placeholder="selectedFile?.name || 'Leave blank to use original filename'"
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="uploading || !isValid"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ uploading ? 'Uploading...' : 'Upload' }}
            </button>
          </div>
          <div v-if="errorMessage" class="px-6 pb-4 text-xs text-red-600">
            {{ errorMessage }}
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/auth'
import { X, Upload, FileText } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  propertyId?: string
}>()

const emit = defineEmits<{
  close: []
  uploaded: []
}>()

const toast = useToast()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const uploading = ref(false)
const isDragging = ref(false)
const selectedFile = ref<File | null>(null)
const errorMessage = ref('')

const form = ref({
  tag: '',
  customName: ''
})

const isValid = computed(() => {
  return form.value.tag && selectedFile.value
})

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be less than 25MB')
      return
    }
    selectedFile.value = file
  }
}

const handleFileDrop = (event: DragEvent) => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be less than 25MB')
      return
    }
    selectedFile.value = file
  }
}

const handleSubmit = async () => {
  if (!props.propertyId || !isValid.value || !selectedFile.value) return

  uploading.value = true
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('document', selectedFile.value)
    formData.append('tag', form.value.tag)
    if (form.value.customName) {
      formData.append('file_name', form.value.customName)
    }

    const response = await fetch(`${API_URL}/api/properties/${props.propertyId}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      },
      body: formData
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to upload document')
    }

    toast.success('Document uploaded successfully')
    emit('uploaded')
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to upload document'
    toast.error(errorMessage.value)
  } finally {
    uploading.value = false
  }
}

const handleClose = () => {
  form.value = { tag: '', customName: '' }
  selectedFile.value = null
  errorMessage.value = ''
  emit('close')
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

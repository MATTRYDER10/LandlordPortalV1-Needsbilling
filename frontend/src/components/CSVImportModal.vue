<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
    @click.self="close"
  >
    <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

      <div
        class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full"
        @click.stop
      >
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-2xl font-bold text-gray-900">Import Landlords from CSV</h3>
            <button
              @click="close"
              class="text-gray-400 hover:text-gray-500"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="space-y-6">
            <!-- Step 1: Upload CSV -->
            <div v-if="step === 1">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
                <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary transition-colors">
                  <div class="space-y-1 text-center">
                    <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                      <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <div class="flex text-sm text-gray-600">
                      <label for="csv-upload" class="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                        <span>Upload a file</span>
                        <input
                          id="csv-upload"
                          ref="fileInput"
                          type="file"
                          accept=".csv"
                          @change="handleFileSelect"
                          class="sr-only"
                        />
                      </label>
                      <p class="pl-1">or drag and drop</p>
                    </div>
                    <p class="text-xs text-gray-500">CSV up to 10MB</p>
                  </div>
                </div>
                <p v-if="selectedFile" class="mt-2 text-sm text-gray-600">
                  Selected: {{ selectedFile.name }}
                </p>
              </div>

              <div class="flex justify-end">
                <button
                  @click="close"
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  @click="parseCSV"
                  :disabled="!selectedFile || parsing"
                  class="ml-3 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ parsing ? 'Parsing...' : 'Next: Map Fields' }}
                </button>
              </div>
            </div>

            <!-- Step 2: Map Fields -->
            <div v-if="step === 2">
              <div class="mb-4">
                <p class="text-sm text-gray-600 mb-4">
                  Map your CSV columns to the PropertyGoose fields. Select the corresponding column for each field.
                </p>
                <div class="bg-gray-50 p-4 rounded-lg mb-4">
                  <p class="text-xs font-medium text-gray-700 mb-2">Preview (first row):</p>
                  <div class="text-xs text-gray-600 font-mono">
                    <div v-for="(value, key) in csvPreview" :key="key" class="mb-1">
                      <span class="font-semibold">{{ key }}:</span> {{ value }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-3 max-h-96 overflow-y-auto">
                <div v-for="field in requiredFields" :key="field.key" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <label class="block text-sm font-medium text-gray-700">{{ field.label }}</label>
                    <p class="text-xs text-gray-500">{{ field.required ? 'Required' : 'Optional' }}</p>
                  </div>
                  <select
                    v-model="fieldMapping[field.key]"
                    class="ml-4 block w-64 px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm"
                  >
                    <option value="">-- Select Column --</option>
                    <option v-for="header in csvHeaders" :key="header" :value="header">
                      {{ header }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="flex justify-end gap-3 mt-6">
                <button
                  @click="step = 1"
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  @click="importCSV"
                  :disabled="!isMappingValid || importing"
                  class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ importing ? 'Importing...' : 'Import Landlords' }}
                </button>
              </div>
            </div>

            <!-- Step 3: Success -->
            <div v-if="step === 3">
              <div class="text-center py-8">
                <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 class="mt-4 text-lg font-medium text-gray-900">Import Successful!</h3>
                <p class="mt-2 text-sm text-gray-600">
                  Successfully imported {{ importCount }} landlord(s).
                </p>
                <div class="mt-6">
                  <button
                    @click="close"
                    class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  imported: []
}>()

const toast = useToast()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const step = ref(1)
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const parsing = ref(false)
const importing = ref(false)
const csvHeaders = ref<string[]>([])
const csvPreview = ref<Record<string, string>>({})
const csvData = ref<any[]>([])
const fieldMapping = ref<Record<string, string>>({})
const importCount = ref(0)

const requiredFields = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'address_line1', label: 'Address Line 1', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'postcode', label: 'Postcode', required: false }
]

const isMappingValid = computed(() => {
  return requiredFields
    .filter(f => f.required)
    .every(f => fieldMapping.value[f.key])
})

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const parseCSV = async () => {
  if (!selectedFile.value) return

  parsing.value = true

  try {
    const text = await selectedFile.value.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      toast.error('CSV file must have at least a header row and one data row')
      return
    }

    // Parse headers
    csvHeaders.value = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    
    // Parse first data row for preview
    const firstRowValues = lines[1].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    csvPreview.value = {}
    csvHeaders.value.forEach((header, index) => {
      csvPreview.value[header] = firstRowValues[index] || ''
    })

    // Parse all data rows
    csvData.value = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row: any = {}
      csvHeaders.value.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      csvData.value.push(row)
    }

    step.value = 2
  } catch (err: any) {
    toast.error('Failed to parse CSV file: ' + err.message)
  } finally {
    parsing.value = false
  }
}

const importCSV = async () => {
  if (!isMappingValid.value || !selectedFile.value) return

  importing.value = true

  try {
    const formData = new FormData()
    formData.append('csv', selectedFile.value)
    formData.append('fieldMapping', JSON.stringify(fieldMapping.value))

    const response = await fetch(`${API_URL}/api/landlords/import-csv`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to import CSV')
    }

    const data = await response.json()
    importCount.value = data.count || 0
    step.value = 3
    toast.success(`Successfully imported ${importCount.value} landlord(s)`)
    emit('imported')
  } catch (err: any) {
    toast.error('Failed to import CSV: ' + err.message)
  } finally {
    importing.value = false
  }
}

const close = () => {
  emit('close')
  // Reset state
  step.value = 1
  selectedFile.value = null
  csvHeaders.value = []
  csvPreview.value = {}
  csvData.value = []
  fieldMapping.value = {}
  importCount.value = 0
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>


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
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full">
        <div class="bg-white px-6 pt-6 pb-4">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-semibold text-gray-900">Import Properties from CSV</h3>
            <button
              type="button"
              @click="handleClose"
              class="text-gray-400 hover:text-gray-600"
            >
              <X class="h-6 w-6" />
            </button>
          </div>

          <!-- Step 1: Upload -->
          <div v-if="step === 'upload'">
            <div
              class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors"
              :class="{ 'border-primary bg-primary/5': isDragging }"
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
              @drop.prevent="handleFileDrop"
            >
              <Upload class="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p class="text-gray-600 mb-2">Drag and drop your CSV file here, or</p>
              <label class="inline-block px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-md cursor-pointer hover:bg-primary/20">
                Browse Files
                <input
                  type="file"
                  accept=".csv"
                  class="hidden"
                  @change="handleFileSelect"
                />
              </label>
              <p class="text-sm text-gray-500 mt-4">
                Required column: postcode<br />
                Optional: address_line1, address_line2, city, county, property_type, bedrooms
              </p>
            </div>
          </div>

          <!-- Step 2: Map Fields -->
          <div v-else-if="step === 'mapping'">
            <div class="mb-4">
              <p class="text-sm text-gray-600 mb-2">
                <FileText class="inline h-4 w-4 mr-1" />
                {{ file?.name }} ({{ rowCount }} rows)
              </p>
              <p class="text-sm text-gray-600 mb-4">
                Map your CSV columns to the PropertyGoose fields. Columns are auto-matched but you can adjust as needed.
              </p>
            </div>

            <!-- Preview of first row -->
            <div class="bg-gray-50 p-3 rounded-lg mb-4">
              <p class="text-xs font-medium text-gray-700 mb-2">Preview (first row):</p>
              <div class="text-xs text-gray-600 font-mono max-h-24 overflow-y-auto">
                <div v-for="(value, key) in csvPreview" :key="key" class="mb-1">
                  <span class="font-semibold">{{ key }}:</span> {{ value }}
                </div>
              </div>
            </div>

            <!-- Field mapping -->
            <div class="space-y-3 max-h-64 overflow-y-auto">
              <div v-for="field in propertyFields" :key="field.key" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <label class="block text-sm font-medium text-gray-700">{{ field.label }}</label>
                  <p class="text-xs text-gray-500">{{ field.required ? 'Required' : 'Optional' }}</p>
                </div>
                <select
                  v-model="fieldMapping[field.key]"
                  class="ml-4 block w-48 px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm"
                >
                  <option value="">-- Select Column --</option>
                  <option v-for="header in headers" :key="header" :value="header">
                    {{ header }}
                  </option>
                </select>
              </div>
            </div>

            <div v-if="!isMappingValid" class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p class="text-sm text-yellow-800">
                <AlertCircle class="inline h-4 w-4 mr-1" />
                Please map the required postcode column before importing.
              </p>
            </div>
          </div>

          <!-- Step 3: Preview -->
          <div v-else-if="step === 'preview'">
            <div class="mb-4">
              <p class="text-sm text-gray-600 mb-2">
                <FileText class="inline h-4 w-4 mr-1" />
                {{ file?.name }} ({{ rowCount }} rows)
              </p>
            </div>

            <div class="mb-4 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
              <table class="min-w-full divide-y divide-gray-200 text-sm">
                <thead class="bg-gray-50 sticky top-0">
                  <tr>
                    <th
                      v-for="header in headers"
                      :key="header"
                      class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      {{ header }}
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="(row, index) in previewRows" :key="index">
                    <td
                      v-for="(cell, cellIndex) in row"
                      :key="cellIndex"
                      class="px-3 py-2 text-gray-900 truncate max-w-[150px]"
                    >
                      {{ cell }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p class="text-sm text-blue-800">
                <CheckCircle class="inline h-4 w-4 mr-1" />
                Column mapping complete. Ready to import {{ rowCount }} properties.
              </p>
            </div>
          </div>

          <!-- Step 4: Importing -->
          <div v-else-if="step === 'importing'">
            <div class="text-center py-8">
              <div class="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p class="text-gray-600">Importing properties...</p>
            </div>
          </div>

          <!-- Step 5: Results -->
          <div v-else-if="step === 'results'">
            <div class="text-center py-4">
              <CheckCircle class="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h4 class="text-lg font-medium text-gray-900 mb-2">Import Complete</h4>
              <p class="text-gray-600 mb-4">
                {{ importResult?.imported }} properties imported<br />
                {{ importResult?.skipped }} rows skipped
              </p>

              <div v-if="importResult?.errors?.length" class="mt-4 text-left max-h-32 overflow-y-auto">
                <p class="text-sm font-medium text-gray-700 mb-2">Errors:</p>
                <ul class="text-sm text-red-600 space-y-1">
                  <li v-for="error in importResult.errors.slice(0, 10)" :key="error.row">
                    Row {{ error.row }}: {{ error.error }}
                  </li>
                  <li v-if="importResult.errors.length > 10">
                    ... and {{ importResult.errors.length - 10 }} more errors
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            v-if="step === 'mapping'"
            type="button"
            @click="step = 'upload'; file = null"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back
          </button>
          <button
            v-if="step === 'preview'"
            type="button"
            @click="step = 'mapping'"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back
          </button>
          <button
            type="button"
            @click="handleClose"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {{ step === 'results' ? 'Close' : 'Cancel' }}
          </button>
          <button
            v-if="step === 'mapping'"
            type="button"
            @click="step = 'preview'"
            :disabled="!isMappingValid"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next: Preview
          </button>
          <button
            v-if="step === 'preview'"
            type="button"
            @click="handleImport"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
          >
            Import Properties
          </button>
          <button
            v-if="step === 'results'"
            type="button"
            @click="handleDone"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/auth'
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-vue-next'

interface ImportResult {
  imported: number
  skipped: number
  errors: Array<{ row: number; error: string }>
}

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  imported: [result: { imported: number; skipped: number }]
}>()

const toast = useToast()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const step = ref<'upload' | 'mapping' | 'preview' | 'importing' | 'results'>('upload')
const isDragging = ref(false)
const file = ref<File | null>(null)
const headers = ref<string[]>([])
const previewRows = ref<string[][]>([])
const rowCount = ref(0)
const importResult = ref<ImportResult | null>(null)
const fieldMapping = ref<Record<string, string>>({})
const csvPreview = ref<Record<string, string>>({})

// Property fields for mapping
const propertyFields = [
  { key: 'postcode', label: 'Postcode', required: true },
  { key: 'address_line1', label: 'Address Line 1', required: false },
  { key: 'address_line2', label: 'Address Line 2', required: false },
  { key: 'city', label: 'City/Town', required: false },
  { key: 'county', label: 'County', required: false },
  { key: 'full_address', label: 'Full Address', required: false },
  { key: 'property_type', label: 'Property Type', required: false },
  { key: 'bedrooms', label: 'Bedrooms', required: false }
]

// Field name variations for auto-matching
const fieldAliases: Record<string, string[]> = {
  postcode: ['postcode', 'post_code', 'post code', 'postal_code', 'postalcode', 'postal code', 'zip', 'zipcode', 'zip code'],
  address_line1: ['address_line1', 'address line 1', 'addressline1', 'address1', 'line1', 'street', 'street address', 'streetaddress'],
  address_line2: ['address_line2', 'address line 2', 'addressline2', 'address2', 'line2'],
  city: ['city', 'town', 'town/city', 'town / city', 'locality'],
  county: ['county', 'state', 'region', 'province'],
  full_address: ['full_address', 'fulladdress', 'address', 'property_address', 'propertyaddress', 'property address'],
  property_type: ['property_type', 'propertytype', 'property type', 'type', 'building_type', 'buildingtype', 'building type'],
  bedrooms: ['bedrooms', 'beds', 'number_of_bedrooms', 'numberofbedrooms', 'bedroom count', 'bed count']
}

// Check if required fields are mapped
const isMappingValid = computed(() => {
  return propertyFields
    .filter(f => f.required)
    .every(f => fieldMapping.value[f.key])
})

// Auto-match fields based on header names
const autoMatchFields = () => {
  fieldMapping.value = {}

  for (const field of propertyFields) {
    const aliases = fieldAliases[field.key] || [field.key]

    // Find a matching header
    const matchedHeader = headers.value.find(header => {
      const normalizedHeader = header.toLowerCase().trim()
      return aliases.some(alias => normalizedHeader === alias)
    })

    if (matchedHeader) {
      fieldMapping.value[field.key] = matchedHeader
    }
  }
}

const handleFileDrop = (event: DragEvent) => {
  isDragging.value = false
  const droppedFile = event.dataTransfer?.files?.[0]
  if (droppedFile) {
    processFile(droppedFile)
  }
}

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const selectedFile = input.files?.[0]
  if (selectedFile) {
    processFile(selectedFile)
  }
}

const processFile = async (selectedFile: File) => {
  if (!selectedFile.name.endsWith('.csv')) {
    toast.error('Please select a CSV file')
    return
  }

  file.value = selectedFile

  try {
    const text = await selectedFile.text()
    const lines = text.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      toast.error('CSV must have at least a header row and one data row')
      return
    }

    // Parse headers
    const headerLine = lines[0]
    if (!headerLine) {
      toast.error('CSV header row is empty')
      return
    }
    headers.value = parseCSVLine(headerLine)

    // Parse preview rows (first 5)
    previewRows.value = lines.slice(1, 6).map(line => parseCSVLine(line))
    rowCount.value = lines.length - 1

    // Build preview of first row for mapping step
    const firstDataLine = lines[1]
    if (firstDataLine) {
      const firstRowValues = parseCSVLine(firstDataLine)
      csvPreview.value = {}
      headers.value.forEach((header, index) => {
        csvPreview.value[header] = firstRowValues[index] || ''
      })
    }

    // Auto-match fields and go to mapping step
    autoMatchFields()
    step.value = 'mapping'
  } catch (err) {
    toast.error('Failed to read CSV file')
  }
}

const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

const handleImport = async () => {
  if (!file.value) return

  step.value = 'importing'

  try {
    const formData = new FormData()
    formData.append('csv', file.value)
    formData.append('fieldMapping', JSON.stringify(fieldMapping.value))

    const response = await fetch(`${API_URL}/api/properties/import-csv`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      },
      body: formData
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to import')
    }

    const data = await response.json()
    importResult.value = data.summary
    step.value = 'results'
  } catch (err: any) {
    toast.error(err.message || 'Failed to import properties')
    step.value = 'preview'
  }
}

const handleDone = () => {
  if (importResult.value) {
    emit('imported', {
      imported: importResult.value.imported,
      skipped: importResult.value.skipped
    })
  }
  handleClose()
}

const handleClose = () => {
  step.value = 'upload'
  file.value = null
  headers.value = []
  previewRows.value = []
  rowCount.value = 0
  importResult.value = null
  fieldMapping.value = {}
  csvPreview.value = {}
  emit('close')
}

watch(() => props.show, (show) => {
  if (!show) {
    handleClose()
  }
})
</script>

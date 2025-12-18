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
              <X class="w-6 h-6" />
            </button>
          </div>

          <div class="space-y-6">
            <!-- Step 1: Upload CSV -->
            <div v-if="step === 1">
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Upload CSV File</label>
                <div
                  class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors"
                  :class="isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'"
                  @dragover.prevent="isDragging = true"
                  @dragenter.prevent="isDragging = true"
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="handleDrop"
                >
                  <div class="space-y-1 text-center">
                    <Upload class="mx-auto h-12 w-12 text-gray-400" />
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
                <CheckCircle class="mx-auto h-12 w-12 text-green-500" />
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
import { X, Upload, CheckCircle } from 'lucide-vue-next'

defineProps<{
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
const isDragging = ref(false)
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
  { key: 'postcode', label: 'Postcode', required: false },
  { key: 'bank_account_name', label: 'Bank Account Name', required: false },
  { key: 'bank_account_number', label: 'Bank Account Number', required: false },
  { key: 'bank_sort_code', label: 'Bank Sort Code', required: false }
]

const isMappingValid = computed(() => {
  return requiredFields
    .filter(f => f.required)
    .every(f => fieldMapping.value[f.key])
})

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (file) {
      selectedFile.value = file
    }
  }
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file && file.name.endsWith('.csv')) {
      selectedFile.value = file
    } else {
      toast.error('Please drop a CSV file')
    }
  }
}

// Field name variations for auto-matching
const fieldAliases: Record<string, string[]> = {
  first_name: ['first_name', 'firstname', 'first name', 'forename', 'given name', 'givenname'],
  last_name: ['last_name', 'lastname', 'last name', 'surname', 'family name', 'familyname'],
  email: ['email', 'e-mail', 'email_address', 'emailaddress', 'email address'],
  phone: ['phone', 'telephone', 'tel', 'mobile', 'phone_number', 'phonenumber', 'phone number', 'contact number'],
  address_line1: ['address_line1', 'address line 1', 'addressline1', 'address1', 'address', 'street', 'street address'],
  city: ['city', 'town', 'town/city', 'town / city'],
  postcode: ['postcode', 'post_code', 'post code', 'postal_code', 'postalcode', 'postal code', 'zip', 'zipcode', 'zip code'],
  bank_account_name: ['bank_account_name', 'account_name', 'accountname', 'account name', 'bank account name', 'name on account'],
  bank_account_number: ['bank_account_number', 'account_number', 'accountnumber', 'account number', 'bank account number', 'account no'],
  bank_sort_code: ['bank_sort_code', 'sort_code', 'sortcode', 'sort code', 'sorting code', 'bank sort code']
}

const autoMatchFields = () => {
  fieldMapping.value = {}

  for (const field of requiredFields) {
    const aliases = fieldAliases[field.key] || [field.key]

    // Find a matching header
    const matchedHeader = csvHeaders.value.find(header => {
      const normalizedHeader = header.toLowerCase().trim()
      return aliases.some(alias => normalizedHeader === alias)
    })

    if (matchedHeader) {
      fieldMapping.value[field.key] = matchedHeader
    }
  }
}

// Properly parse a CSV line handling quoted fields with commas
const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      // Check for escaped quote (two consecutive quotes)
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip the next quote
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

  // Don't forget the last field
  result.push(current.trim())

  return result
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
    const headerLine = lines[0]
    if (!headerLine) {
      toast.error('CSV file is empty')
      return
    }
    csvHeaders.value = parseCSVLine(headerLine)

    // Parse first data row for preview
    const firstDataLine = lines[1]
    if (firstDataLine) {
      const firstRowValues = parseCSVLine(firstDataLine)
      csvPreview.value = {}
      csvHeaders.value.forEach((header, index) => {
        csvPreview.value[header] = firstRowValues[index] || ''
      })
    }

    // Parse all data rows
    csvData.value = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      const values = parseCSVLine(line)
      const row: any = {}
      csvHeaders.value.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      csvData.value.push(row)
    }

    // Auto-match fields based on header names
    autoMatchFields()

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


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
              <h3 class="text-xl font-semibold text-gray-900">
                {{ isEditing ? 'Edit Compliance Record' : 'Add Compliance Record' }}
              </h3>
              <button
                type="button"
                @click="handleClose"
                class="text-gray-400 hover:text-gray-600"
              >
                <X class="h-6 w-6" />
              </button>
            </div>

            <div class="space-y-4">
              <!-- Compliance Type -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Compliance Type <span class="text-red-500">*</span>
                </label>
                <select
                  v-model="form.compliance_type"
                  required
                  :disabled="isEditing"
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">Select type...</option>
                  <option value="gas_safety">Gas Safety Certificate</option>
                  <option value="eicr">EICR (Electrical)</option>
                  <option value="epc">EPC (Energy Performance)</option>
                  <option value="council_licence">Council Licence</option>
                  <option value="pat_test">PAT Test</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <!-- Issue Date -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Issue Date <span class="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  v-model="form.issue_date"
                  required
                  :max="today"
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <!-- Expiry Date (auto-calculated but overridable) -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date
                  <span v-if="autoExpiryDate" class="text-gray-500 font-normal">(auto-calculated)</span>
                </label>
                <input
                  type="date"
                  v-model="form.expiry_date"
                  :min="form.issue_date"
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p v-if="autoExpiryDate && form.expiry_date !== autoExpiryDate" class="text-xs text-amber-600 mt-1">
                  Standard expiry would be {{ formatDate(autoExpiryDate) }}
                </p>
              </div>

              <!-- Certificate Number -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Certificate Number</label>
                <input
                  type="text"
                  v-model="form.certificate_number"
                  placeholder="e.g., GSC-2024-12345"
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <!-- Issuer Name -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Issuer / Engineer Name</label>
                <input
                  type="text"
                  v-model="form.issuer_name"
                  placeholder="Name of issuing person"
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <!-- Issuer Company -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Issuer Company</label>
                <input
                  type="text"
                  v-model="form.issuer_company"
                  placeholder="Company name"
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <!-- Notes -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  v-model="form.notes"
                  rows="2"
                  placeholder="Any additional notes..."
                  class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                ></textarea>
              </div>

              <!-- Document Upload (for new records) -->
              <div v-if="!isEditing">
                <label class="block text-sm font-medium text-gray-700 mb-1">Certificate Document</label>
                <div
                  class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary transition-colors"
                  :class="{ 'border-primary bg-primary/5': isDragging }"
                  @dragover.prevent="isDragging = true"
                  @dragleave="isDragging = false"
                  @drop.prevent="handleFileDrop"
                >
                  <div v-if="!selectedFile">
                    <Upload class="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p class="text-sm text-gray-600 mb-1">Drag and drop or</p>
                    <label class="inline-block px-3 py-1 text-sm font-medium text-primary bg-primary/10 rounded cursor-pointer hover:bg-primary/20">
                      Browse Files
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        class="hidden"
                        @change="handleFileSelect"
                      />
                    </label>
                    <p class="text-xs text-gray-500 mt-2">PDF, JPG, PNG up to 25MB</p>
                  </div>
                  <div v-else class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <FileText class="h-5 w-5 text-gray-400" />
                      <span class="text-sm text-gray-700">{{ selectedFile.name }}</span>
                    </div>
                    <button type="button" @click="selectedFile = null" class="text-red-500 hover:text-red-700">
                      <X class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="bg-gray-50 px-6 py-4 flex justify-between">
            <button
              v-if="isEditing"
              type="button"
              @click="handleDelete"
              :disabled="saving"
              class="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Delete
            </button>
            <div v-else></div>
            <div class="flex gap-3">
              <button
                type="button"
                @click="handleClose"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="saving || !isValid"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ saving ? 'Saving...' : (isEditing ? 'Update' : 'Add Record') }}
              </button>
            </div>
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
import { ref, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../../stores/auth'
import { X, Upload, FileText } from 'lucide-vue-next'
import { formatDate as formatUkDate } from '../../utils/date'

interface ComplianceRecord {
  id: string
  compliance_type: string
  issue_date: string | null
  expiry_date: string | null
  status: string
  certificate_number: string | null
  issuer_name: string | null
  issuer_company?: string | null
  notes?: string | null
}

const props = defineProps<{
  show: boolean
  propertyId?: string
  complianceRecord?: ComplianceRecord | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const saving = ref(false)
const isDragging = ref(false)
const selectedFile = ref<File | null>(null)
const errorMessage = ref('')

const form = ref({
  compliance_type: '',
  issue_date: '',
  expiry_date: '',
  certificate_number: '',
  issuer_name: '',
  issuer_company: '',
  notes: ''
})

const today = computed(() => new Date().toISOString().split('T')[0])

const isEditing = computed(() => !!props.complianceRecord)

const isValid = computed(() => {
  return form.value.compliance_type && form.value.issue_date
})

// Auto-calculate expiry date based on compliance type
const autoExpiryDate = computed(() => {
  if (!form.value.issue_date || !form.value.compliance_type) return null

  // Parse the YYYY-MM-DD string directly to avoid timezone issues
  const parts = form.value.issue_date.split('-')
  if (parts.length !== 3) return null
  const year = parts[0]!
  const month = parts[1]!
  const day = parts[2]!
  let yearsToAdd = 0

  switch (form.value.compliance_type) {
    case 'gas_safety':
    case 'pat_test':
      yearsToAdd = 1
      break
    case 'eicr':
      yearsToAdd = 5
      break
    case 'epc':
      yearsToAdd = 10
      break
    default:
      return null
  }

  const expiryYear = parseInt(year, 10) + yearsToAdd
  return `${expiryYear}-${month}-${day}`
})

const resetForm = () => {
  form.value = {
    compliance_type: '',
    issue_date: '',
    expiry_date: '',
    certificate_number: '',
    issuer_name: '',
    issuer_company: '',
    notes: ''
  }
  selectedFile.value = null
}

// Watch for issue date and type changes to auto-set expiry
watch([() => form.value.issue_date, () => form.value.compliance_type], () => {
  if (autoExpiryDate.value && !form.value.expiry_date) {
    form.value.expiry_date = autoExpiryDate.value
  }
})

// Load existing record data when editing
watch(() => props.complianceRecord, (record) => {
  if (record) {
    form.value = {
      compliance_type: record.compliance_type || '',
      issue_date: record.issue_date || '',
      expiry_date: record.expiry_date || '',
      certificate_number: record.certificate_number || '',
      issuer_name: record.issuer_name || '',
      issuer_company: record.issuer_company || '',
      notes: record.notes || ''
    }
  } else {
    resetForm()
  }
}, { immediate: true })

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    selectedFile.value = file
  }
}

const handleFileDrop = (event: DragEvent) => {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    selectedFile.value = file
  }
}

const handleSubmit = async () => {
  if (!props.propertyId || !isValid.value) return

  saving.value = true
  errorMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('compliance_type', form.value.compliance_type)
    formData.append('issue_date', form.value.issue_date)
    if (form.value.expiry_date) formData.append('expiry_date', form.value.expiry_date)
    if (form.value.certificate_number) formData.append('certificate_number', form.value.certificate_number)
    if (form.value.issuer_name) formData.append('issuer_name', form.value.issuer_name)
    if (form.value.issuer_company) formData.append('issuer_company', form.value.issuer_company)
    if (form.value.notes) formData.append('notes', form.value.notes)
    if (selectedFile.value) formData.append('document', selectedFile.value)

    const url = isEditing.value
      ? `${API_URL}/api/properties/${props.propertyId}/compliance/${props.complianceRecord?.id}`
      : `${API_URL}/api/properties/${props.propertyId}/compliance`

    const response = await fetch(url, {
      method: isEditing.value ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`
      },
      body: formData
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save compliance record')
    }

    toast.success(isEditing.value ? 'Compliance record updated' : 'Compliance record added')
    emit('saved')
  } catch (err: any) {
    errorMessage.value = err.message || 'Failed to save compliance record'
    toast.error(errorMessage.value)
  } finally {
    saving.value = false
  }
}

const handleDelete = async () => {
  if (!props.propertyId || !props.complianceRecord?.id) return

  if (!confirm('Are you sure you want to delete this compliance record?')) return

  saving.value = true

  try {
    const response = await fetch(
      `${API_URL}/api/properties/${props.propertyId}/compliance/${props.complianceRecord.id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authStore.session?.access_token}`
        }
      }
    )

    if (!response.ok) {
      throw new Error('Failed to delete compliance record')
    }

    toast.success('Compliance record deleted')
    emit('saved')
  } catch (err: any) {
    toast.error(err.message || 'Failed to delete compliance record')
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  resetForm()
  errorMessage.value = ''
  emit('close')
}

const formatDate = (dateString?: string | null) =>
  formatUkDate(dateString, { day: '2-digit', month: '2-digit', year: 'numeric' }, 'n/a')
</script>

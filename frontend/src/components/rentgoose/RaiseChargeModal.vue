<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="fixed inset-0 bg-gray-500 bg-opacity-75" @click="$emit('close')"></div>
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-lg w-full">
        <form @submit.prevent="handleSubmit">
          <div class="px-6 pt-6 pb-4">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Raise Invoice / Charge</h3>
              <button type="button" @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                &times;
              </button>
            </div>

            <div class="space-y-4">
              <!-- Property Search -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Property</label>
                <div class="relative">
                  <input
                    v-model="propertySearch"
                    @input="searchProperties"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-md"
                    :placeholder="selectedProperty ? selectedProperty.address : 'Search by address or postcode...'"
                  />
                  <div
                    v-if="propertyResults.length > 0 && showPropertyDropdown"
                    class="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto"
                  >
                    <button
                      v-for="p in propertyResults"
                      :key="p.id"
                      type="button"
                      @click="selectProperty(p)"
                      class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-white"
                    >
                      {{ p.address }} — {{ p.postcode }}
                    </button>
                  </div>
                </div>
                <div v-if="selectedProperty" class="mt-1 text-xs text-green-600 dark:text-green-400">
                  Selected: {{ selectedProperty.address }} — {{ selectedProperty.postcode }}
                </div>
              </div>

              <!-- Description -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  v-model="form.description"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-md"
                  placeholder="e.g. Boiler repair"
                />
              </div>

              <!-- Amount -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Amount (£)</label>
                <input
                  v-model.number="form.amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-md"
                  placeholder="0.00"
                />
              </div>

              <!-- VAT -->
              <div class="flex items-center gap-2">
                <input
                  v-model="form.include_vat"
                  type="checkbox"
                  id="include-vat"
                  class="rounded border-gray-300 dark:border-slate-600"
                />
                <label for="include-vat" class="text-sm text-gray-700 dark:text-slate-300">Include VAT (20%)</label>
                <span v-if="form.include_vat && form.amount" class="text-xs text-gray-500 dark:text-slate-400">
                  VAT: £{{ (form.amount * 0.2).toFixed(2) }} | Total: £{{ (form.amount * 1.2).toFixed(2) }}
                </span>
              </div>

              <!-- Payee Type -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Payee</label>
                <div class="flex gap-3">
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input v-model="form.payee_type" type="radio" value="agent" class="text-primary" />
                    <span class="text-sm text-gray-700 dark:text-slate-300">Agent</span>
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer">
                    <input v-model="form.payee_type" type="radio" value="contractor" class="text-primary" />
                    <span class="text-sm text-gray-700 dark:text-slate-300">Contractor</span>
                  </label>
                </div>
              </div>

              <!-- Invoice Number (if payee = contractor) -->
              <div v-if="form.payee_type === 'contractor'">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Invoice Number</label>
                <input
                  v-model="form.invoice_number"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-md"
                  placeholder="e.g. INV-001"
                />
              </div>

              <!-- Contractor Search (if payee = contractor) -->
              <div v-if="form.payee_type === 'contractor'">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Contractor</label>
                <div class="relative">
                  <input
                    v-model="contractorSearch"
                    @input="searchContractors"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-md"
                    :placeholder="selectedContractor ? selectedContractor.name : 'Search contractors...'"
                  />
                  <div
                    v-if="contractorResults.length > 0 && showContractorDropdown"
                    class="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto"
                  >
                    <button
                      v-for="c in contractorResults"
                      :key="c.id"
                      type="button"
                      @click="selectContractor(c)"
                      class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-white"
                    >
                      {{ c.name }} <span class="text-gray-400">{{ c.commission_percent }}% commission</span>
                    </button>
                  </div>
                </div>
                <div v-if="selectedContractor" class="mt-1 text-xs text-green-600 dark:text-green-400">
                  Selected: {{ selectedContractor.name }} ({{ selectedContractor.commission_percent }}% commission)
                </div>
              </div>
              <div v-if="form.payee_type === 'contractor' && form.charge_mode !== 'credit'">
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">PDF Invoice (optional)</label>
                <input type="file" accept=".pdf" @change="onFileSelect" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded-md" />
              </div>

              <div v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>
              <div v-if="successMsg" class="text-sm text-green-600 dark:text-green-400">{{ successMsg }}</div>
            </div>
          </div>

          <div class="bg-gray-50 dark:bg-slate-800 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
            <button type="button" @click="$emit('close')" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:text-gray-900">
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving || !selectedProperty || !form.description || !form.amount"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ saving ? 'Submitting...' : 'Submit Charge' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useApi } from '../../composables/useApi'

defineProps<{ show: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const { get, post } = useApi()
const saving = ref(false)
const error = ref('')
const successMsg = ref('')

const form = ref({
  description: '',
  amount: null as number | null,
  include_vat: false,
  payee_type: 'agent',
  contractor_id: null as string | null,
  invoice_number: ''
})

const selectedFile = ref<File | null>(null)
function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

// Property search
const propertySearch = ref('')
const propertyResults = ref<any[]>([])
const selectedProperty = ref<any>(null)
const showPropertyDropdown = ref(false)

let propertySearchTimer: ReturnType<typeof setTimeout> | null = null
function searchProperties() {
  showPropertyDropdown.value = true
  if (propertySearchTimer) clearTimeout(propertySearchTimer)
  propertySearchTimer = setTimeout(async () => {
    if (!propertySearch.value || propertySearch.value.length < 2) {
      propertyResults.value = []
      return
    }
    try {
      const result = await get<any>(`/api/properties?search=${encodeURIComponent(propertySearch.value)}&limit=10`)
      propertyResults.value = (result.properties || []).map((p: any) => ({
        id: p.id,
        address: p.address_line1 || p.address || 'Unknown',
        postcode: p.postcode || ''
      }))
    } catch (err) {
      console.error('Property search failed:', err)
    }
  }, 300)
}

function selectProperty(p: any) {
  selectedProperty.value = p
  propertySearch.value = ''
  showPropertyDropdown.value = false
  propertyResults.value = []
}

// Contractor search
const contractorSearch = ref('')
const contractorResults = ref<any[]>([])
const selectedContractor = ref<any>(null)
const showContractorDropdown = ref(false)

let contractorSearchTimer: ReturnType<typeof setTimeout> | null = null
function searchContractors() {
  showContractorDropdown.value = true
  if (contractorSearchTimer) clearTimeout(contractorSearchTimer)
  contractorSearchTimer = setTimeout(async () => {
    try {
      const result = await get<any>('/api/contractors')
      const contractors = result.contractors || result || []
      const search = contractorSearch.value.toLowerCase()
      contractorResults.value = contractors.filter((c: any) =>
        c.name?.toLowerCase().includes(search) || c.company_name?.toLowerCase().includes(search)
      ).slice(0, 10)
    } catch (err) {
      console.error('Contractor search failed:', err)
    }
  }, 300)
}

function selectContractor(c: any) {
  selectedContractor.value = c
  form.value.contractor_id = c.id
  contractorSearch.value = ''
  showContractorDropdown.value = false
  contractorResults.value = []
}

async function handleSubmit() {
  if (!selectedProperty.value) return
  saving.value = true
  error.value = ''
  successMsg.value = ''

  try {
    const result = await post<any>('/api/rentgoose/raise-charge', {
      property_id: selectedProperty.value.id,
      description: form.value.description,
      amount: form.value.amount,
      include_vat: form.value.include_vat,
      payee_type: form.value.payee_type,
      contractor_id: form.value.payee_type === 'contractor' ? form.value.contractor_id : null
    })

    if (result.status === 'pending') {
      successMsg.value = 'Charge stored as pending — will attach to next rent period'
    } else {
      successMsg.value = 'Charge attached to next rent period'
    }

    setTimeout(() => {
      emit('saved')
    }, 1500)
  } catch (err: any) {
    error.value = err.message || 'Failed to raise charge'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-lg rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <div :class="['px-6 py-4 border-b', isDark ? 'border-slate-700' : 'border-gray-200']">
          <h2 class="text-lg font-semibold">Upload Invoice — {{ contractor.name }}</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">Invoice Number *</label>
              <input v-model="form.invoice_number" type="text" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Invoice Date</label>
              <input v-model="form.invoice_date" type="date" :class="inputClass" />
            </div>
          </div>
          <!-- Property search -->
          <div>
            <label :class="labelClass">Property *</label>
            <div class="relative">
              <input
                v-model="propertySearch"
                @input="searchProperties"
                type="text"
                :class="inputClass"
                :placeholder="selectedProperty ? `${selectedProperty.address}, ${selectedProperty.postcode}` : 'Search by address or postcode...'"
              />
              <div
                v-if="propertyResults.length > 0 && showPropertyDropdown"
                class="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg max-h-40 overflow-y-auto"
              >
                <button
                  v-for="p in propertyResults"
                  :key="p.id"
                  type="button"
                  @click="selectProperty(p)"
                  class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  {{ p.address }} — {{ p.postcode }}
                </button>
              </div>
            </div>
            <p v-if="selectedProperty" class="mt-1 text-xs text-green-600">{{ selectedProperty.address }}, {{ selectedProperty.postcode }}</p>
          </div>

          <div>
            <label :class="labelClass">Gross Amount *</label>
            <input v-model.number="form.gross_amount" type="number" step="0.01" :class="inputClass" placeholder="0.00" />
          </div>

          <!-- Commission breakdown -->
          <div v-if="form.gross_amount > 0" :class="['rounded-xl p-4', isDark ? 'bg-slate-800' : 'bg-gray-50']">
            <div class="flex justify-between text-sm mb-1">
              <span>Invoice total</span>
              <span>&pound;{{ form.gross_amount.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-sm mb-1">
              <span>Commission ({{ contractor.commission_percent }}%{{ contractor.commission_vat ? ' + VAT' : '' }})</span>
              <span class="text-primary">-&pound;{{ commissionGross.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-sm font-bold pt-2 border-t" :class="isDark ? 'border-slate-600' : 'border-gray-300'">
              <span>Payout to contractor</span>
              <span class="text-emerald-500">&pound;{{ payoutAmount.toFixed(2) }}</span>
            </div>
          </div>

          <div>
            <label :class="labelClass">PDF Invoice (optional)</label>
            <input type="file" accept=".pdf" @change="onFileChange" :class="inputClass" />
          </div>
        </div>
        <div :class="['px-6 py-4 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button @click="$emit('close')" :class="['px-4 py-2 text-sm rounded-lg', isDark ? 'bg-slate-800' : 'bg-gray-100']">Cancel</button>
          <button @click="upload" :disabled="!form.invoice_number || !form.gross_amount || submitting" class="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg disabled:opacity-50">
            {{ submitting ? 'Uploading...' : 'Upload Invoice' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'
import { useRentGooseStore, type Contractor } from '../../stores/rentgoose'

const props = defineProps<{ contractor: Contractor }>()
const emit = defineEmits<{ close: []; uploaded: [] }>()

const { isDark } = useDarkMode()
const store = useRentGooseStore()
const { get, apiFetch } = useApi()

const submitting = ref(false)
const form = ref({
  invoice_number: '',
  invoice_date: new Date().toISOString().split('T')[0],
  gross_amount: 0,
  property_id: '' as string,
})

// Property search
const propertySearch = ref('')
const propertyResults = ref<any[]>([])
const selectedProperty = ref<any>(null)
const showPropertyDropdown = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | null = null
function searchProperties() {
  showPropertyDropdown.value = true
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
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
    } catch { propertyResults.value = [] }
  }, 300)
}

function selectProperty(p: any) {
  selectedProperty.value = p
  form.value.property_id = p.id
  propertySearch.value = ''
  showPropertyDropdown.value = false
}

const commissionNet = computed(() => form.value.gross_amount * (props.contractor.commission_percent / 100))
const commissionVat = computed(() => props.contractor.commission_vat ? commissionNet.value * 0.20 : 0)
const commissionGross = computed(() => commissionNet.value + commissionVat.value)
const payoutAmount = computed(() => form.value.gross_amount - commissionGross.value)

const selectedFile = ref<File | null>(null)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

async function upload() {
  submitting.value = true
  try {
    const formData = new FormData()
    formData.append('contractor_id', props.contractor.id)
    formData.append('invoice_number', form.value.invoice_number)
    formData.append('invoice_date', form.value.invoice_date)
    formData.append('gross_amount', String(form.value.gross_amount))
    if (form.value.property_id) formData.append('property_id', form.value.property_id)
    if (selectedFile.value) formData.append('invoice_pdf', selectedFile.value)

    const response = await apiFetch('/api/rentgoose/contractor-invoice', {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(err.error || 'Upload failed')
    }
    emit('uploaded')
  } finally {
    submitting.value = false
  }
}

const labelClass = computed(() => `block text-xs font-medium uppercase tracking-wide mb-1 ${isDark.value ? 'text-slate-400' : 'text-gray-500'}`)
const inputClass = computed(() => `w-full px-3 py-2 text-sm rounded-lg border ${isDark.value ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-primary/50`)
</script>

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
        class="inline-block align-bottom bg-white dark:bg-slate-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-200 dark:border-slate-700"
        @click.stop
      >
        <div class="bg-white dark:bg-slate-900 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">
              Send Offer Form
            </h3>
            <button
              @click="close"
              class="text-gray-400 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-300"
            >
              <X class="w-6 h-6" />
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div v-if="errorMessage" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
              {{ errorMessage }}
            </div>

            <!-- Applicant Email -->
            <div>
              <label for="applicant-email" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Tenant Email Address *
              </label>
              <input id="applicant-email" v-model="formData.applicant_email" type="email" required
                placeholder="tenant@example.com"
                class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary sm:text-sm" />
            </div>

            <!-- Entry Mode Toggle -->
            <div class="flex gap-3">
              <button
                @click="propertyEntryMode = 'select'; propertySearchQuery && fetchProperties()"
                type="button"
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                :class="propertyEntryMode === 'select'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                "
              >
                <Building class="w-4 h-4" />
                Select from Properties
              </button>
              <button
                @click="propertyEntryMode = 'manual'; clearPropertySelection()"
                type="button"
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                :class="propertyEntryMode === 'manual'
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                "
              >
                Enter Manually
              </button>
            </div>

            <!-- Selected Property Banner -->
            <div v-if="selectedPropertyId" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3 flex items-center justify-between">
              <div class="flex items-center">
                <Building class="w-4 h-4 text-green-600 mr-2" />
                <span class="text-sm font-medium text-green-900 dark:text-green-200">{{ formData.property_address }}, {{ formData.property_city }} {{ formData.property_postcode }}</span>
              </div>
              <button
                @click="clearPropertySelection"
                type="button"
                class="text-sm text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 font-medium"
              >
                Clear
              </button>
            </div>

            <!-- Property Selector -->
            <div v-if="propertyEntryMode === 'select' && !selectedPropertyId" class="space-y-3">
              <div class="flex gap-3">
                <div class="flex-1">
                  <input
                    v-model="propertySearchQuery"
                    type="text"
                    placeholder="Search by address or postcode..."
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary text-sm"
                    @keydown.enter.prevent="fetchProperties"
                  />
                </div>
                <button
                  @click="fetchProperties"
                  type="button"
                  :disabled="loadingProperties"
                  class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm"
                >
                  {{ loadingProperties ? 'Loading...' : 'Search' }}
                </button>
              </div>

              <!-- Loading State -->
              <div v-if="loadingProperties" class="text-center py-4">
                <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>

              <!-- No Properties -->
              <div v-else-if="!loadingProperties && availableProperties.length === 0" class="text-center py-4">
                <p class="text-sm text-gray-600 dark:text-slate-400">
                  {{ propertySearchQuery
                    ? 'No properties match your search'
                    : 'Search by address or postcode to select a property'
                  }}
                </p>
              </div>

              <!-- Property Cards -->
              <div v-else class="space-y-2">
                <!-- Results limit warning -->
                <div v-if="availableProperties.length >= 20" class="text-xs text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded px-2 py-1.5">
                  Showing first 20 results. Refine your search for more specific results.
                </div>

                <div class="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                  <div
                    v-for="property in availableProperties"
                    :key="property.id"
                    @click="selectPropertyForOffer(property)"
                    class="border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-md p-3 cursor-pointer transition-all hover:shadow-sm hover:border-primary/50 flex items-center justify-between"
                  >
                    <div>
                      <span class="font-medium text-gray-900 dark:text-white">{{ property.address_line1 }}</span>
                      <span class="text-sm text-gray-600 dark:text-slate-400 ml-2">{{ property.city }}, {{ property.postcode }}</span>
                    </div>
                    <svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Property Address (Manual Entry) -->
            <div v-if="propertyEntryMode === 'manual'" class="relative overflow-visible">
              <AddressAutocomplete v-model="formData.property_address" label="Property Address to Rent"
                :required="true" id="property-address" placeholder="Start typing address..."
                @addressSelected="handlePropertyAddressSelected" />
            </div>

            <!-- Rent Amount -->
            <div>
              <label for="rent-amount" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Monthly Rent Amount (£) *
              </label>
              <input id="rent-amount" v-model.number="formData.rent_amount" type="number" step="0.01"
                required min="0" placeholder="e.g., 1200"
                class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary sm:text-sm" />
            </div>

            <!-- Bills Included -->
            <div class="flex items-start gap-3">
              <input id="bills-included" type="checkbox"
                v-model="formData.bills_included"
                class="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800" />
              <div>
                <label for="bills-included" class="text-sm font-medium text-gray-900 dark:text-white">
                  Bills Included
                </label>
                <p class="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                  Check if utility bills are included in the rent amount.
                </p>
              </div>
            </div>

            <!-- Deposit Replacement Offer -->
            <div class="flex items-start gap-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3">
              <input id="offer-deposit-replacement" type="checkbox"
                v-model="formData.offer_deposit_replacement"
                class="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800" />
              <div>
                <label for="offer-deposit-replacement" class="text-sm font-medium text-gray-900 dark:text-white">
                  Offer Deposit Replacement
                </label>
                <p class="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                  Include an option for the tenant to request deposit replacement service.
                </p>
              </div>
            </div>

            <!-- Buttons -->
            <div class="flex justify-end space-x-3 pt-2">
              <button type="button" @click="close"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700">
                Cancel
              </button>
              <button type="submit" :disabled="loading"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                <span v-if="loading">Sending...</span>
                <span v-else>Send Offer</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import { authFetch } from '../lib/authFetch'
import AddressAutocomplete from './AddressAutocomplete.vue'
import { isValidEmail } from '../utils/validation'
import { X, Building } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'sent'): void
}>()

const toast = useToast()
const authStore = useAuthStore()
const formData = ref({
  applicant_email: '',
  property_address: '',
  property_city: '',
  property_postcode: '',
  rent_amount: null as number | null,
  offer_deposit_replacement: false,
  bills_included: false
})

const errorMessage = ref<string | null>(null)
const loading = ref(false)

// Property selection
const propertyEntryMode = ref('select')
const availableProperties = ref<any[]>([])
const selectedPropertyId = ref<string | null>(null)
const propertySearchQuery = ref('')
const loadingProperties = ref(false)

const resetForm = () => {
  formData.value = {
    applicant_email: '',
    property_address: '',
    property_city: '',
    property_postcode: '',
    rent_amount: null,
    offer_deposit_replacement: false,
    bills_included: false
  }
  errorMessage.value = null
  propertyEntryMode.value = 'select'
  selectedPropertyId.value = null
  availableProperties.value = []
  propertySearchQuery.value = ''
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    resetForm()
    // Don't auto-load properties - let user search first
  }
})

// Fetch properties from API
async function fetchProperties() {
  loadingProperties.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    // Build query params with search and limit
    const params = new URLSearchParams()
    if (propertySearchQuery.value) {
      params.append('search', propertySearchQuery.value)
    }
    params.append('limit', '20') // Limit to 20 results for performance

    const response = await authFetch(`${API_URL}/api/properties?${params.toString()}`, { token })

    if (response.ok) {
      const data = await response.json()
      availableProperties.value = data.properties || []
    }
  } catch (error) {
    console.error('Failed to fetch properties:', error)
  } finally {
    loadingProperties.value = false
  }
}

// Select a property from the list
function selectPropertyForOffer(property: any) {
  selectedPropertyId.value = property.id
  formData.value.property_address = property.address_line1
  formData.value.property_city = property.city
  formData.value.property_postcode = property.postcode
  formData.value.bills_included = property.bills_included || false
}

// Clear property selection
function clearPropertySelection() {
  selectedPropertyId.value = null
  propertyEntryMode.value = 'manual'
}

const close = () => {
  emit('close')
}

const handlePropertyAddressSelected = (addressData: any) => {
  formData.value.property_address = addressData.addressLine1
  formData.value.property_city = addressData.city || ''
  formData.value.property_postcode = addressData.postcode || ''
}

const handleSubmit = async () => {
  errorMessage.value = null

  if (!formData.value.applicant_email || !formData.value.property_address || !formData.value.rent_amount) {
    errorMessage.value = 'Please fill in all required fields'
    return
  }

  if (!isValidEmail(formData.value.applicant_email)) {
    errorMessage.value = 'Please enter a valid email address'
    return
  }

  loading.value = true

  try {
    const token = authStore.session?.access_token
    if (!token) {
      errorMessage.value = 'You must be logged in to send the offer form'
      return
    }

    const response = await authFetch(`${API_URL}/api/tenant-offers/send-link`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tenant_email: formData.value.applicant_email,
        property_address: formData.value.property_address,
        property_city: formData.value.property_city,
        property_postcode: formData.value.property_postcode,
        rent_amount: formData.value.rent_amount,
        offer_deposit_replacement: formData.value.offer_deposit_replacement,
        bills_included: formData.value.bills_included,
        linked_property_id: selectedPropertyId.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      errorMessage.value = data.error || 'Failed to send offer form'
      return
    }

    toast.success(`Offer form sent to ${formData.value.applicant_email}`)
    emit('sent')
    close()
  } catch (err: any) {
    errorMessage.value = err.message || 'An error occurred while sending the offer form'
  } finally {
    loading.value = false
  }
}
</script>

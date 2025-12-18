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
        class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
        @click.stop
      >
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-900">
              Send Offer Form
            </h3>
            <button
              @click="close"
              class="text-gray-400 hover:text-gray-500"
            >
              <X class="w-6 h-6" />
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
              {{ errorMessage }}
            </div>

            <!-- Applicant Email -->
            <div>
              <label for="applicant-email" class="block text-sm font-medium text-gray-700 mb-1">
                Tenant Email Address *
              </label>
              <input id="applicant-email" v-model="formData.applicant_email" type="email" required
                placeholder="tenant@example.com"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm" />
            </div>

            <!-- Property Address -->
            <div class="relative overflow-visible">
              <AddressAutocomplete v-model="formData.property_address" label="Property Address to Rent"
                :required="true" id="property-address" placeholder="Start typing address..."
                @addressSelected="handlePropertyAddressSelected" />
            </div>

            <!-- Rent Amount -->
            <div>
              <label for="rent-amount" class="block text-sm font-medium text-gray-700 mb-1">
                Monthly Rent Amount (£) *
              </label>
              <input id="rent-amount" v-model.number="formData.rent_amount" type="number" step="0.01"
                required min="0" placeholder="e.g., 1200"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm" />
            </div>

            <!-- Deposit Replacement Offer -->
            <div class="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <input id="offer-deposit-replacement" type="checkbox"
                v-model="formData.offer_deposit_replacement"
                class="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
              <div>
                <label for="offer-deposit-replacement" class="text-sm font-medium text-gray-900">
                  Offer Deposit Replacement
                </label>
                <p class="text-xs text-gray-600 mt-0.5">
                  Include an option for the tenant to request deposit replacement service.
                </p>
              </div>
            </div>

            <!-- Buttons -->
            <div class="flex justify-end space-x-3 pt-2">
              <button type="button" @click="close"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
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
import AddressAutocomplete from './AddressAutocomplete.vue'
import { isValidEmail } from '../utils/validation'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'sent'): void
}>()

const toast = useToast()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const formData = ref({
  applicant_email: '',
  property_address: '',
  property_city: '',
  property_postcode: '',
  rent_amount: null as number | null,
  offer_deposit_replacement: false
})

const errorMessage = ref<string | null>(null)
const loading = ref(false)

const resetForm = () => {
  formData.value = {
    applicant_email: '',
    property_address: '',
    property_city: '',
    property_postcode: '',
    rent_amount: null,
    offer_deposit_replacement: false
  }
  errorMessage.value = null
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    resetForm()
  }
})

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

    const response = await fetch(`${API_URL}/api/tenant-offers/send-link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tenant_email: formData.value.applicant_email,
        property_address: formData.value.property_address,
        property_city: formData.value.property_city,
        property_postcode: formData.value.property_postcode,
        rent_amount: formData.value.rent_amount,
        offer_deposit_replacement: formData.value.offer_deposit_replacement
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

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ company ? 'Edit Company' : 'Add Company Landlord' }}
        </h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
          <X class="w-5 h-5" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-6 space-y-5">
        <!-- Company Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Company Name <span class="text-red-500">*</span></label>
          <input v-model="form.company_name" type="text" required placeholder="e.g. Smith Properties Ltd"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white" />
          <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">This name will appear on contracts and agreements</p>
        </div>

        <!-- Registered Address -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Registered Address</label>
          <AddressAutocomplete
            v-model="form.registered_address_line1"
            placeholder="Start typing address..."
            id="company-address"
            @address-selected="handleAddressSelected"
          />
          <input v-model="form.registered_address_line2" type="text" placeholder="Address line 2 (optional)"
            class="w-full px-3 py-2 mt-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
          <div class="grid grid-cols-2 gap-2 mt-2">
            <input v-model="form.registered_city" type="text" placeholder="City"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
            <input v-model="form.registered_postcode" type="text" placeholder="Postcode"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white uppercase" />
          </div>
        </div>

        <!-- Directors -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Directors</label>
          <input v-model="form.directors" type="text" placeholder="e.g. John Smith, Jane Smith"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
        </div>

        <!-- Contact -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone</label>
            <input v-model="form.phone" type="tel" placeholder="020 1234 5678"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
            <input v-model="form.email" type="email" placeholder="info@company.com"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
          </div>
        </div>

        <!-- Bank Details -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Bank Details</label>
          <div class="space-y-2">
            <input v-model="form.bank_account_name" type="text" placeholder="Account name"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input v-model="form.bank_account_number" type="text" placeholder="Account number" maxlength="8"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
              <input v-model="form.bank_sort_code" type="text" placeholder="Sort code (12-34-56)" maxlength="8"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
            </div>
          </div>
        </div>

        <!-- Error -->
        <div v-if="errorMessage" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {{ errorMessage }}
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="$emit('close')" class="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium">
            Cancel
          </button>
          <button type="submit" :disabled="saving" class="px-6 py-2 bg-primary text-white hover:bg-primary/90 rounded-lg text-sm font-medium disabled:opacity-50">
            {{ saving ? 'Saving...' : (company ? 'Save Changes' : 'Add Company') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import AddressAutocomplete from '../AddressAutocomplete.vue'
import { X } from 'lucide-vue-next'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL
const authStore = useAuthStore()

const props = defineProps<{
  company: any | null
  maxCompanies: number
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const form = ref({
  company_name: '',
  registered_address_line1: '',
  registered_address_line2: '',
  registered_city: '',
  registered_postcode: '',
  directors: '',
  phone: '',
  email: '',
  bank_account_name: '',
  bank_account_number: '',
  bank_sort_code: '',
})

const saving = ref(false)
const errorMessage = ref('')

onMounted(() => {
  if (props.company) {
    form.value = {
      company_name: props.company.company_name || '',
      registered_address_line1: props.company.registered_address_line1 || '',
      registered_address_line2: props.company.registered_address_line2 || '',
      registered_city: props.company.registered_city || '',
      registered_postcode: props.company.registered_postcode || '',
      directors: props.company.directors || '',
      phone: props.company.phone || '',
      email: props.company.email || '',
      bank_account_name: props.company.bank_account_name || '',
      bank_account_number: props.company.bank_account_number || '',
      bank_sort_code: props.company.bank_sort_code || '',
    }
  }
})

function handleAddressSelected(address: any) {
  form.value.registered_address_line1 = address.addressLine1
  if (address.addressLine2) form.value.registered_address_line2 = address.addressLine2
  form.value.registered_city = address.city
  form.value.registered_postcode = address.postcode
}

async function handleSubmit() {
  errorMessage.value = ''

  if (!form.value.company_name.trim()) {
    errorMessage.value = 'Company name is required'
    return
  }

  saving.value = true

  try {
    const token = authStore.session?.access_token
    const headers = { Authorization: `Bearer ${token}` }
    const payload = { ...form.value, max_companies: props.maxCompanies }

    if (props.company) {
      await axios.put(`${API_URL}/api/landlord-portal/companies/${props.company.id}`, payload, { headers })
    } else {
      await axios.post(`${API_URL}/api/landlord-portal/companies`, payload, { headers })
    }

    emit('saved')
  } catch (err: any) {
    errorMessage.value = err.response?.data?.error || 'Failed to save company'
  } finally {
    saving.value = false
  }
}
</script>

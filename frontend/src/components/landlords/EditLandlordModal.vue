<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Edit Landlord Details</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600"><X class="w-5 h-5" /></button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-6 space-y-5">
        <!-- Name -->
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Title</label>
            <select v-model="form.title" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white">
              <option value="">—</option>
              <option v-for="t in ['Mr','Mrs','Ms','Miss','Dr']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">First Name *</label>
            <input v-model="form.first_name" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Last Name *</label>
            <input v-model="form.last_name" type="text" required class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Middle Name</label>
          <input v-model="form.middle_name" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Date of Birth</label>
            <input v-model="form.date_of_birth" type="date" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone</label>
            <input v-model="form.phone" type="tel" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
          <input v-model="form.email" type="email" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name on Contracts</label>
          <input v-model="form.full_name_displayed_on_contracts" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email Greeting</label>
          <input v-model="form.preferred_email_greeting" type="text" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
        </div>

        <!-- Address -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Residential Address</label>
          <AddressAutocomplete
            v-model="form.residential_address_line1"
            placeholder="Start typing address..."
            id="edit-landlord-address"
            @address-selected="handleAddr"
          />
          <input v-model="form.residential_address_line2" type="text" placeholder="Line 2 (optional)" class="w-full px-3 py-2 mt-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
          <div class="grid grid-cols-2 gap-2 mt-2">
            <input v-model="form.residential_city" type="text" placeholder="City" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
            <input v-model="form.residential_postcode" type="text" placeholder="Postcode" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white uppercase" />
          </div>
        </div>

        <!-- Bank -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Bank Details</label>
          <div class="space-y-2">
            <input v-model="form.bank_account_name" type="text" placeholder="Account name" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input v-model="form.bank_account_number" type="text" placeholder="Account number" maxlength="8" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
              <input v-model="form.bank_sort_code" type="text" placeholder="Sort code" maxlength="8" class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white" />
            </div>
          </div>
        </div>

        <div v-if="errorMessage" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {{ errorMessage }}
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="$emit('close')" class="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-sm font-medium">Cancel</button>
          <button type="submit" :disabled="saving" class="px-6 py-2 bg-primary text-white hover:bg-primary/90 rounded-lg text-sm font-medium disabled:opacity-50">
            {{ saving ? 'Saving...' : 'Save Changes' }}
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

const props = defineProps<{ landlord: any }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const form = ref<any>({})
const saving = ref(false)
const errorMessage = ref('')

onMounted(() => {
  form.value = { ...props.landlord }
})

function handleAddr(a: any) {
  form.value.residential_address_line1 = a.addressLine1
  if (a.addressLine2) form.value.residential_address_line2 = a.addressLine2
  form.value.residential_city = a.city
  form.value.residential_postcode = a.postcode
}

async function handleSubmit() {
  saving.value = true
  errorMessage.value = ''
  try {
    await axios.put(`${API_URL}/api/landlord-portal/profile`, form.value, {
      headers: { Authorization: `Bearer ${authStore.session?.access_token}` }
    })
    emit('saved')
  } catch (err: any) {
    errorMessage.value = err.response?.data?.error || 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

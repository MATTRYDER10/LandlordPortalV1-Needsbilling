<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <div :class="['px-6 py-4 border-b', isDark ? 'border-slate-700' : 'border-gray-200']">
          <h2 class="text-lg font-semibold">{{ contractor ? 'Edit Contractor' : 'Add Contractor' }}</h2>
        </div>
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">Name *</label>
              <input v-model="form.name" type="text" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Company Name</label>
              <input v-model="form.company_name" type="text" :class="inputClass" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">Email</label>
              <input v-model="form.email" type="email" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Phone</label>
              <input v-model="form.phone" type="tel" :class="inputClass" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <label :class="labelClass">Bank Account Name</label>
              <input v-model="form.bank_account_name" type="text" :class="inputClass" />
            </div>
            <div>
              <label :class="labelClass">Sort Code</label>
              <input v-model="form.bank_sort_code" type="text" :class="inputClass" placeholder="00-00-00" />
            </div>
            <div>
              <label :class="labelClass">Account Number</label>
              <input v-model="form.bank_account_number" type="text" :class="inputClass" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">Commission %</label>
              <input v-model.number="form.commission_percent" type="number" step="0.01" :class="inputClass" />
            </div>
            <div class="flex items-end pb-1">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.commission_vat" class="rounded text-primary" />
                <span class="text-sm">VAT on commission</span>
              </label>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label :class="labelClass">PI Policy Number</label>
              <input v-model="form.pi_policy_number" type="text" :class="inputClass" placeholder="e.g. PI-12345678" />
            </div>
            <div>
              <label :class="labelClass">PI Expiry Date</label>
              <input v-model="form.pi_expiry_date" type="date" :class="inputClass" />
            </div>
          </div>
          <div>
            <label :class="labelClass">Notes</label>
            <textarea v-model="form.notes" :class="inputClass" rows="2"></textarea>
          </div>
        </div>
        <div :class="['px-6 py-4 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button @click="$emit('close')" :class="['px-4 py-2 text-sm rounded-lg', isDark ? 'bg-slate-800' : 'bg-gray-100']">Cancel</button>
          <button @click="save" :disabled="!form.name || saving" class="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg disabled:opacity-50">{{ saving ? 'Saving...' : 'Save' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'
import { useApi } from '../../composables/useApi'
import type { Contractor } from '../../stores/rentgoose'

const props = defineProps<{ contractor: Contractor | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { isDark } = useDarkMode()
const { post, put } = useApi()

const form = ref({
  name: '',
  company_name: '',
  email: '',
  phone: '',
  bank_account_name: '',
  bank_sort_code: '',
  bank_account_number: '',
  commission_percent: 0,
  commission_vat: false,
  pi_policy_number: '',
  pi_expiry_date: '',
  notes: '',
})

onMounted(() => {
  if (props.contractor) {
    form.value = {
      name: props.contractor.name,
      company_name: props.contractor.company_name || '',
      email: props.contractor.email || '',
      phone: props.contractor.phone || '',
      bank_account_name: props.contractor.bank_details.account_name || '',
      bank_sort_code: props.contractor.bank_details.sort_code || '',
      bank_account_number: props.contractor.bank_details.account_number || '',
      commission_percent: props.contractor.commission_percent,
      commission_vat: props.contractor.commission_vat,
      pi_policy_number: (props.contractor as any).pi_policy_number || '',
      pi_expiry_date: (props.contractor as any).pi_expiry_date || '',
      notes: props.contractor.notes || '',
    }
  }
})

const saving = ref(false)

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    if (props.contractor) {
      await put(`/api/contractors/${props.contractor.id}`, form.value)
    } else {
      await post('/api/contractors', form.value)
    }
    emit('saved')
  } catch (err) {
    console.error('Failed to save contractor:', err)
  } finally {
    saving.value = false
  }
}

const labelClass = computed(() => `block text-xs font-medium uppercase tracking-wide mb-1 ${isDark.value ? 'text-slate-400' : 'text-gray-500'}`)
const inputClass = computed(() => `w-full px-3 py-2 text-sm rounded-lg border ${isDark.value ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300'} focus:ring-2 focus:ring-primary/50`)
</script>

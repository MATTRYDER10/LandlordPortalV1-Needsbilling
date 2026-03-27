<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Mark Deposit as Protected</h3>
            <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-4">
          <div>
            <p class="text-sm text-gray-600 dark:text-slate-400">
              Deposit Amount: <span class="font-semibold">&pound;{{ tenancy?.deposit_amount?.toLocaleString() || '0' }}</span>
            </p>
          </div>

          <!-- Deposit Scheme -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Deposit Scheme *
            </label>
            <select
              v-model="form.depositScheme"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="">Select scheme...</option>
              <option value="tds_custodial">TDS Custodial</option>
              <option value="tds_insured">TDS Insured</option>
              <option value="mydeposits">mydeposits</option>
              <option value="dps">DPS</option>
              <option value="reposit">Reposit (Deposit-Free)</option>
              <option value="landlord_held">Landlord Held</option>
              <option value="no_deposit">No Deposit</option>
            </select>
          </div>

          <!-- Deposit Reference -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Deposit Reference
            </label>
            <input
              v-model="form.depositReference"
              type="text"
              placeholder="Certificate number or reference..."
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          <!-- Protection Date -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Protection Date *
            </label>
            <input
              v-model="form.protectedAt"
              type="date"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          <!-- Error -->
          <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
            :disabled="submitting || !isValid"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
          >
            {{ submitting ? 'Saving...' : 'Mark as Protected' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { X } from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  show: boolean
  tenancy: any | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()
const authStore = useAuthStore()
const submitting = ref(false)
const error = ref('')

const form = ref({
  depositScheme: '',
  depositReference: '',
  protectedAt: new Date().toISOString().split('T')[0]
})

const isValid = computed(() => {
  return form.value.depositScheme && form.value.protectedAt
})

// Reset form when modal opens
watch(() => props.show, (isShow) => {
  if (isShow) {
    form.value = {
      depositScheme: props.tenancy?.deposit_scheme || '',
      depositReference: props.tenancy?.deposit_reference || '',
      protectedAt: new Date().toISOString().split('T')[0]
    }
    error.value = ''
  }
})

const handleSave = async () => {
  if (!isValid.value || !props.tenancy) return

  submitting.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancy.id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          depositScheme: form.value.depositScheme,
          depositReference: form.value.depositReference,
          depositProtectedAt: form.value.protectedAt
        })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to update deposit protection')
    }

    toast.success('Deposit marked as protected')
    emit('saved')
  } catch (err: any) {
    console.error('Error saving deposit protection:', err)
    error.value = err.message || 'Failed to save'
  } finally {
    submitting.value = false
  }
}
</script>

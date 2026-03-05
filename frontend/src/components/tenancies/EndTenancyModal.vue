<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">End Tenancy</h3>
          <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {{ tenancy?.property?.address_line1 }}
          </p>
        </div>

        <!-- Content -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
          <!-- End Date -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              End Date *
            </label>
            <input
              v-model="form.endDate"
              type="date"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
              The last day of the tenancy
            </p>
          </div>

          <!-- Reason -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Reason
            </label>
            <select
              v-model="form.reason"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value="">Select a reason...</option>
              <option value="tenant_notice">Tenant gave notice</option>
              <option value="landlord_notice">Landlord gave notice</option>
              <option value="mutual_agreement">Mutual agreement</option>
              <option value="end_of_fixed_term">End of fixed term</option>
              <option value="breach">Breach of tenancy</option>
              <option value="eviction">Eviction</option>
              <option value="other">Other</option>
            </select>
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              v-model="form.notes"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              placeholder="Any additional notes about ending this tenancy..."
            ></textarea>
          </div>

          <!-- Warning -->
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div class="flex gap-3">
              <AlertTriangle class="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div class="text-sm text-amber-800">
                <p class="font-medium">Important</p>
                <ul class="mt-1 list-disc list-inside space-y-1 text-amber-700">
                  <li>This will mark the tenancy as ended</li>
                  <li>Ensure all checkout procedures are complete</li>
                  <li>Deposit return should be processed separately</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p class="text-sm text-red-700">{{ error }}</p>
          </div>
        </form>

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
            @click="handleSubmit"
            :disabled="submitting || !form.endDate"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
          >
            {{ submitting ? 'Ending...' : 'End Tenancy' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { AlertTriangle } from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  show: boolean
  tenancy: any | null
}>()

const emit = defineEmits<{
  close: []
  ended: []
}>()

const toast = useToast()
const authStore = useAuthStore()
// Form state
const form = ref({
  endDate: '',
  reason: '',
  notes: ''
})
const submitting = ref(false)
const error = ref('')

// Reset form when modal opens
watch(() => props.show, (isShow) => {
  if (isShow) {
    // Default end date to today
    form.value = {
      endDate: new Date().toISOString().split('T')[0] || '',
      reason: '',
      notes: ''
    }
    error.value = ''
  }
})

const handleSubmit = async () => {
  if (!props.tenancy || !form.value.endDate) return

  submitting.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenancies/records/${props.tenancy.id}/end`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endDate: form.value.endDate,
          reason: form.value.reason || undefined
        })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to end tenancy')
    }

    toast.success('Tenancy ended successfully')
    emit('ended')
  } catch (err: any) {
    console.error('Error ending tenancy:', err)
    error.value = err.message || 'Failed to end tenancy'
  } finally {
    submitting.value = false
  }
}
</script>

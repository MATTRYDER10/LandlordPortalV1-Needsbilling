<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click.self="$emit('close')">
    <div class="bg-white rounded-lg max-w-md w-full">
      <div class="p-6 pb-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">Change Move-in Date</h3>
        <p class="mt-1 text-sm text-gray-500">{{ tenancy?.propertyAddress }}</p>
      </div>

      <div class="p-6 space-y-4">
        <div>
          <p class="text-sm text-gray-500 mb-2">Current move-in date: <span class="font-medium text-gray-900">{{ formatDate(tenancy?.moveInDate) }}</span></p>
        </div>

        <DatePicker
          v-model="newDate"
          label="New Move-in Date"
          :required="true"
          year-range-type="move-in"
        />

        <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
          {{ error }}
        </div>
      </div>

      <div class="p-6 pt-4 border-t border-gray-200 flex justify-end space-x-3">
        <button
          type="button"
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="save"
          :disabled="saving || !newDate"
          class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Tenancy } from '@/composables/useTenancies'
import DatePicker from '@/components/DatePicker.vue'
import { useAuthStore } from '@/stores/auth'

const API_BASE = import.meta.env.VITE_API_URL
const props = defineProps<{
  show: boolean
  tenancy: Tenancy | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const authStore = useAuthStore()
const newDate = ref('')
const saving = ref(false)
const error = ref('')

// Reset form when modal opens/closes or tenancy changes
watch(() => [props.show, props.tenancy], () => {
  if (props.show && props.tenancy) {
    newDate.value = props.tenancy.moveInDate || ''
    error.value = ''
  }
}, { immediate: true })

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return 'Not set'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

async function save() {
  if (!props.tenancy || !newDate.value) return

  saving.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE}/api/references/${props.tenancy.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ move_in_date: newDate.value })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to update move-in date')
    }

    emit('saved')
    emit('close')
  } catch (err: any) {
    error.value = err.message || 'Failed to update move-in date'
  } finally {
    saving.value = false
  }
}
</script>

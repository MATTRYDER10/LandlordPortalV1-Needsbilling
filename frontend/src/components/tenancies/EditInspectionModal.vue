<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('update:open', false)">
      <div class="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-lg w-full mx-4 overflow-hidden">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-[#10B981]/20">
              <Pencil class="w-4 h-4 text-[#10B981]" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Edit Inspection</h3>
          </div>
          <button
            @click="$emit('update:open', false)"
            class="p-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Form -->
        <div class="p-6 space-y-4">
          <!-- Date -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Date</label>
            <input
              v-model="form.scheduledDate"
              type="date"
              :min="minDate"
              class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-[#10B981] focus:border-[#10B981] dark:bg-slate-800 dark:text-white text-sm"
            />
          </div>

          <!-- Time -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Time</label>
            <select
              v-model="form.scheduledTime"
              class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-[#10B981] focus:border-[#10B981] dark:bg-slate-800 dark:text-white text-sm"
            >
              <option v-for="slot in timeSlots" :key="slot" :value="slot">{{ slot }}</option>
            </select>
          </div>

          <!-- Assessor -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Assessor</label>
            <div v-if="loadingAssessors" class="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 py-2">
              <Loader2 class="w-4 h-4 animate-spin" />
              Loading assessors...
            </div>
            <select
              v-else
              v-model="form.assessorId"
              class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-[#10B981] focus:border-[#10B981] dark:bg-slate-800 dark:text-white text-sm"
            >
              <option value="">Auto-assign</option>
              <option v-for="assessor in assessors" :key="assessor.id" :value="assessor.id">
                {{ assessor.name }} ({{ assessor.initials }})
              </option>
            </select>
          </div>

          <!-- Error -->
          <div v-if="error" class="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm">
            {{ error }}
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2">
            <button
              @click="$emit('update:open', false)"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Cancel
            </button>
            <button
              @click="handleSubmit"
              :disabled="submitting || !form.scheduledDate || !form.scheduledTime"
              class="px-4 py-2 text-sm font-medium text-white bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-2"
            >
              <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
              Update Inspection
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { X, Pencil, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/authFetch'
import { API_URL } from '@/lib/apiUrl'

const props = defineProps<{
  open: boolean
  appointment: any
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: []
}>()

const authStore = useAuthStore()

const form = ref({
  scheduledDate: '',
  scheduledTime: '10:00',
  assessorId: ''
})

const assessors = ref<Array<{ id: string; name: string; initials: string; email: string }>>([])
const loadingAssessors = ref(false)
const submitting = ref(false)
const error = ref('')

const minDate = computed(() => {
  const today = new Date()
  return today.toISOString().split('T')[0]
})

const timeSlots = computed(() => {
  const slots: string[] = []
  for (let h = 8; h <= 18; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`)
    if (h < 18) {
      slots.push(`${h.toString().padStart(2, '0')}:30`)
    }
  }
  return slots
})

async function fetchAssessors() {
  loadingAssessors.value = true
  try {
    const response = await authFetch(`${API_URL}/api/ig/assessors`, {
      token: authStore.session?.access_token || undefined
    })
    if (response.ok) {
      const data = await response.json()
      assessors.value = data.assessors || []
    }
  } catch (err) {
    console.error('[EditInspection] Error fetching assessors:', err)
  } finally {
    loadingAssessors.value = false
  }
}

async function handleSubmit() {
  error.value = ''
  submitting.value = true
  try {
    const response = await authFetch(`${API_URL}/api/ig/appointments/${props.appointment.id}`, {
      method: 'PATCH',
      token: authStore.session?.access_token || undefined,
      body: JSON.stringify({
        scheduledDate: form.value.scheduledDate,
        scheduledTime: form.value.scheduledTime,
        assessorId: form.value.assessorId || undefined
      })
    })

    const data = await response.json()

    if (!response.ok) {
      error.value = data.error || 'Failed to update inspection'
      return
    }

    emit('updated')
    emit('update:open', false)
  } catch (err) {
    error.value = 'Failed to update inspection'
  } finally {
    submitting.value = false
  }
}

// Pre-populate form when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen && props.appointment) {
    error.value = ''
    form.value = {
      scheduledDate: props.appointment.scheduled_date || '',
      scheduledTime: props.appointment.scheduled_time || '10:00',
      assessorId: props.appointment.assessor_id || ''
    }
    fetchAssessors()
  }
})
</script>

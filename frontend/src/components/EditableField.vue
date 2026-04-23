<template>
  <div class="flex justify-between items-center text-sm group min-h-[28px] overflow-hidden">
    <span class="text-gray-500 dark:text-slate-400 shrink-0 mr-3">{{ label }}</span>
    <div class="flex items-center gap-1 min-w-0">
      <!-- View mode -->
      <template v-if="!editing">
        <span class="text-gray-900 dark:text-white text-right truncate min-w-0" :title="displayValue">{{ displayValue }}</span>
        <button
          v-if="editable && field"
          @click.stop="startEdit"
          class="p-1 text-gray-400 hover:text-primary transition-colors shrink-0"
          title="Edit"
        >
          <Pencil class="w-3 h-3" />
        </button>
      </template>
      <!-- Edit mode -->
      <template v-else>
        <input
          ref="inputRef"
          v-model="editValue"
          class="w-40 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary text-right"
          @keyup.enter="saveEdit"
          @keyup.escape="cancelEdit"
        />
        <button @click="saveEdit" :disabled="saving" class="p-1 text-green-500 hover:text-green-600">
          <Check class="w-3.5 h-3.5" />
        </button>
        <button @click="cancelEdit" class="p-1 text-gray-400 hover:text-red-500">
          <X class="w-3.5 h-3.5" />
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Pencil, Check, X } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const props = withDefaults(defineProps<{
  label: string
  value?: string | null
  field?: string
  referenceId?: string
  editable?: boolean
  useAdminEndpoint?: boolean
}>(), {
  value: '',
  editable: true,
  useAdminEndpoint: false
})

const emit = defineEmits<{
  saved: [result: any]
}>()

const API_URL = import.meta.env.VITE_API_URL ?? ''
const authStore = useAuthStore()

const editing = ref(false)
const editValue = ref('')
const saving = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const displayValue = computed(() => props.value ?? '-')

function startEdit() {
  editValue.value = props.value ?? ''
  editing.value = true
  nextTick(() => inputRef.value?.focus())
}

function cancelEdit() {
  editing.value = false
}

async function saveEdit() {
  if (!props.field || !props.referenceId || editValue.value === props.value) {
    editing.value = false
    return
  }

  saving.value = true
  try {
    const endpoint = props.useAdminEndpoint
      ? `${API_URL}/api/v2/admin/references/${props.referenceId}/edit`
      : `${API_URL}/api/v2/references/${props.referenceId}/edit`
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ field: props.field, value: editValue.value })
    })

    if (response.ok) {
      const data = await response.json()
      editing.value = false
      emit('saved', { ...data, field: props.field })
    } else {
      const err = await response.json()
      alert(err.error || 'Failed to save')
    }
  } catch {
    alert('Failed to save')
  } finally {
    saving.value = false
  }
}
</script>

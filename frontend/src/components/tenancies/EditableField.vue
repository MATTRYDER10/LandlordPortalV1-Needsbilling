<template>
  <div
    class="group relative"
    :class="{ 'cursor-pointer': canEdit }"
    @click="startEditing"
  >
    <!-- View Mode -->
    <div v-if="!isEditing" class="flex items-center gap-1">
      <slot name="display">
        <span :class="displayClass">{{ displayValue }}</span>
      </slot>
      <Pencil
        v-if="canEdit"
        class="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>

    <!-- Edit Mode -->
    <div v-else class="flex items-center gap-2" @click.stop>
      <!-- Text Input -->
      <input
        v-if="type === 'text' || type === 'number'"
        ref="inputRef"
        v-model="editValue"
        :type="type"
        :min="min"
        :max="max"
        :step="step"
        class="px-2 py-1 text-sm border border-primary rounded focus:ring-1 focus:ring-primary focus:outline-none w-full"
        :class="inputClass"
        @keydown.enter="save"
        @keydown.escape="cancel"
        @blur="handleBlur"
      />

      <!-- Date Input -->
      <input
        v-else-if="type === 'date'"
        ref="inputRef"
        v-model="editValue"
        type="date"
        class="px-2 py-1 text-sm border border-primary rounded focus:ring-1 focus:ring-primary focus:outline-none"
        :class="inputClass"
        @keydown.enter="save"
        @keydown.escape="cancel"
        @blur="handleBlur"
      />

      <!-- Select -->
      <select
        v-else-if="type === 'select'"
        ref="inputRef"
        v-model="editValue"
        class="px-2 py-1 text-sm border border-primary rounded focus:ring-1 focus:ring-primary focus:outline-none"
        :class="inputClass"
        @keydown.escape="cancel"
        @change="save"
        @blur="handleBlur"
      >
        <option
          v-for="opt in options"
          :key="String(opt.value)"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>

      <!-- Boolean Toggle -->
      <div v-else-if="type === 'boolean'" class="flex items-center gap-2">
        <button
          @click="editValue = true; save()"
          class="px-2 py-1 text-xs font-medium rounded"
          :class="editValue === true ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : 'bg-gray-100 text-gray-600'"
        >
          Yes
        </button>
        <button
          @click="editValue = false; save()"
          class="px-2 py-1 text-xs font-medium rounded"
          :class="editValue === false ? 'bg-gray-200 text-gray-700 ring-2 ring-gray-400' : 'bg-gray-100 text-gray-600'"
        >
          No
        </button>
        <button
          @click="cancel"
          class="p-1 text-gray-400 hover:text-gray-600"
        >
          <X class="w-3 h-3" />
        </button>
      </div>

      <!-- Save/Cancel buttons for text inputs -->
      <div v-if="type !== 'boolean' && type !== 'select'" class="flex items-center gap-1">
        <button
          @click="save"
          :disabled="saving"
          class="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
        >
          <Check class="w-4 h-4" />
        </button>
        <button
          @click="cancel"
          class="p-1 text-gray-400 hover:text-gray-600"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Saving Indicator -->
    <div v-if="saving" class="absolute inset-0 flex items-center justify-center bg-white/80">
      <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { Pencil, Check, X } from 'lucide-vue-next'

interface Option {
  value: string | number | boolean
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: string | number | boolean | null
  type?: 'text' | 'number' | 'date' | 'select' | 'boolean'
  options?: Option[]
  canEdit?: boolean
  displayValue?: string
  displayClass?: string
  inputClass?: string
  min?: number
  max?: number
  step?: number
  formatDisplay?: (value: any) => string
}>(), {
  type: 'text',
  canEdit: true,
  options: () => [],
  displayClass: '',
  inputClass: '',
  step: 1
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | boolean | null]
  save: [value: string | number | boolean | null]
}>()

const isEditing = ref(false)
const editValue = ref<any>(props.modelValue)
const saving = ref(false)
const inputRef = ref<HTMLInputElement | HTMLSelectElement | null>(null)

// Watch for external value changes
watch(() => props.modelValue, (newVal) => {
  if (!isEditing.value) {
    editValue.value = newVal
  }
})

const startEditing = () => {
  if (!props.canEdit) return
  editValue.value = props.modelValue
  isEditing.value = true
  nextTick(() => {
    inputRef.value?.focus()
    if (inputRef.value && 'select' in inputRef.value) {
      inputRef.value.select()
    }
  })
}

const save = async () => {
  if (saving.value) return

  // Convert value based on type
  let finalValue = editValue.value
  if (props.type === 'number' && editValue.value !== null && editValue.value !== '') {
    finalValue = Number(editValue.value)
  }

  saving.value = true
  try {
    emit('update:modelValue', finalValue)
    emit('save', finalValue)
    isEditing.value = false
  } finally {
    saving.value = false
  }
}

const cancel = () => {
  editValue.value = props.modelValue
  isEditing.value = false
}

const handleBlur = (e: FocusEvent) => {
  // Don't cancel if clicking save/cancel buttons
  const relatedTarget = e.relatedTarget as HTMLElement
  if (relatedTarget?.closest('.flex.items-center.gap-1')) return
  // Small delay to allow click events to fire
  setTimeout(() => {
    if (isEditing.value && !saving.value) {
      cancel()
    }
  }, 150)
}
</script>

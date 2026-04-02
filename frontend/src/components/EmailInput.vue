<template>
  <div>
    <input
      :value="modelValue"
      @input="onInput"
      @blur="onBlur"
      type="email"
      v-bind="$attrs"
      :class="[
        inputClass,
        validation.error ? 'border-red-400 dark:border-red-600' : '',
        validation.suggestion ? 'border-amber-400 dark:border-amber-600' : ''
      ]"
    />
    <!-- Domain suggestion -->
    <p v-if="validation.suggestion && !validation.error" class="mt-1 text-xs text-amber-600 dark:text-amber-400">
      Did you mean <button type="button" @click="applySuggestion" class="font-semibold underline hover:no-underline">{{ validation.suggestedEmail }}</button>?
    </p>
    <!-- Validation error -->
    <p v-if="validation.error" class="mt-1 text-xs text-red-500 dark:text-red-400">
      {{ validation.error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { validateEmail } from '@/composables/useEmailValidation'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: string
  inputClass?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const validation = reactive({
  error: '',
  suggestion: null as string | null,
  suggestedEmail: null as string | null,
})

let timeout: ReturnType<typeof setTimeout> | null = null

function runValidation(value: string) {
  const result = validateEmail(value)
  validation.error = result.error
  validation.suggestion = result.suggestion
  validation.suggestedEmail = result.suggestedEmail
}

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value)

  // Clear suggestion immediately on new input
  validation.suggestion = null
  validation.suggestedEmail = null

  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(() => runValidation(value), 500)
}

function onBlur() {
  // Validate immediately on blur
  if (timeout) clearTimeout(timeout)
  runValidation(props.modelValue)
}

function applySuggestion() {
  if (validation.suggestedEmail) {
    emit('update:modelValue', validation.suggestedEmail)
    validation.suggestion = null
    validation.suggestedEmail = null
    validation.error = ''
  }
}

// Validate if value changes externally
watch(() => props.modelValue, (val) => {
  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(() => runValidation(val), 500)
})
</script>

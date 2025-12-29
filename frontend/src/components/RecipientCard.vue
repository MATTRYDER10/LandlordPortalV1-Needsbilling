<template>
  <div class="p-3 bg-gray-50 rounded-lg">
    <div class="flex justify-between items-start">
      <div>
        <span class="font-medium text-gray-900">{{ recipient.name }}</span>
        <span class="text-xs text-gray-500 ml-2 capitalize">({{ recipientTypeLabel }})</span>
      </div>
      <button
        v-if="canRemove"
        @click="$emit('remove', recipient)"
        class="text-red-400 hover:text-red-600 p-1"
        title="Remove recipient"
      >
        <Trash2 class="w-4 h-4" />
      </button>
    </div>

    <!-- Email field -->
    <div class="mt-2">
      <div v-if="isEditing" class="flex items-center gap-2">
        <input
          ref="emailInput"
          v-model="emailValue"
          type="email"
          @blur="saveEmail"
          @keyup.enter="saveEmail"
          @keyup.escape="cancelEdit"
          :class="[
            'flex-1 text-sm px-2 py-1 border rounded focus:ring-primary focus:border-primary',
            emailError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
          ]"
          placeholder="Enter email address"
        />
        <button
          @click="saveEmail"
          class="text-green-600 hover:text-green-700 p-1"
          title="Save"
        >
          <Check class="w-4 h-4" />
        </button>
        <button
          @click="cancelEdit"
          class="text-gray-400 hover:text-gray-600 p-1"
          title="Cancel"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <div v-else @click="startEdit" class="flex items-center cursor-pointer group">
        <Mail class="w-4 h-4 mr-2 text-gray-400" />
        <span :class="[
          'text-sm',
          recipient.email ? 'text-gray-700' : 'text-red-500 italic'
        ]">
          {{ recipient.email || 'No email - click to add' }}
        </span>
        <Pencil class="w-3 h-3 ml-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p v-if="emailError" class="text-xs text-red-500 mt-1">{{ emailError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Trash2, Mail, Pencil, Check, X } from 'lucide-vue-next'

interface Recipient {
  type: 'landlord' | 'tenant' | 'guarantor'
  index: number
  name: string
  email: string
  isRequired?: boolean
}

const props = defineProps<{
  recipient: Recipient
  canRemove?: boolean
}>()

const emit = defineEmits<{
  (e: 'update', recipient: Recipient): void
  (e: 'remove', recipient: Recipient): void
}>()

const isEditing = ref(false)
const emailValue = ref(props.recipient.email || '')
const emailError = ref('')
const emailInput = ref<HTMLInputElement | null>(null)

const recipientTypeLabel = computed(() => {
  switch (props.recipient.type) {
    case 'landlord':
      return 'Landlord'
    case 'tenant':
      return 'Tenant'
    case 'guarantor':
      return 'Guarantor'
    default:
      return props.recipient.type
  }
})

const validateEmail = (email: string): boolean => {
  if (!email) return true // Empty is allowed, but will be flagged as missing
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const startEdit = () => {
  emailValue.value = props.recipient.email || ''
  emailError.value = ''
  isEditing.value = true
  nextTick(() => {
    emailInput.value?.focus()
  })
}

const saveEmail = () => {
  const trimmedEmail = emailValue.value.trim()

  if (trimmedEmail && !validateEmail(trimmedEmail)) {
    emailError.value = 'Please enter a valid email address'
    return
  }

  emailError.value = ''
  isEditing.value = false

  if (trimmedEmail !== props.recipient.email) {
    emit('update', {
      ...props.recipient,
      email: trimmedEmail
    })
  }
}

const cancelEdit = () => {
  emailValue.value = props.recipient.email || ''
  emailError.value = ''
  isEditing.value = false
}
</script>

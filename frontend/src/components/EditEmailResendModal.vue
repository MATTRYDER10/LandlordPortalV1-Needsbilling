<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
    @click.self="close"
  >
    <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

      <div
        class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full"
        @click.stop
      >
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-900">
              Resend {{ referenceType === 'tenant' ? 'Tenant' : referenceType === 'employer' ? 'Employer' : 'Guarantor' }} Reference Email
            </h3>
            <button
              @click="close"
              class="text-gray-400 hover:text-gray-500"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input
                v-model="email"
                type="email"
                required
                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Enter email address"
              />
              <p v-if="emailError" class="mt-1 text-sm text-red-600">{{ emailError }}</p>
            </div>

            <p class="text-sm text-gray-500">
              {{ email !== originalEmail
                ? 'The email address will be updated and the invitation will be sent to the new address.'
                : 'The invitation will be resent to this email address.' }}
            </p>

            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                @click="close"
                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="sending || !!emailError"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ sending ? 'Sending...' : 'Send' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { isValidEmail } from '../utils/validation'

const props = defineProps<{
  show: boolean
  currentEmail: string
  referenceType: 'tenant' | 'employer' | 'guarantor' | 'guarantor_self'
}>()

const emit = defineEmits<{
  close: []
  submit: [email: string]
}>()

const email = ref('')
const originalEmail = ref('')
const sending = ref(false)

const emailError = computed(() => {
  if (!email.value) return ''
  if (!isValidEmail(email.value)) return 'Please enter a valid email address'
  return ''
})

watch(() => props.show, (newVal) => {
  if (newVal) {
    email.value = props.currentEmail
    originalEmail.value = props.currentEmail
    sending.value = false
  }
})

const close = () => {
  emit('close')
}

const handleSubmit = () => {
  if (emailError.value || !email.value) return
  sending.value = true
  emit('submit', email.value)
}

// Expose sending state so parent can control it
defineExpose({ sending })
</script>

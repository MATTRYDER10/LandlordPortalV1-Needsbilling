<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div
        class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        aria-hidden="true"
        @click="$emit('close')"
      ></div>

      <!-- Center modal -->
      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

      <!-- Modal panel -->
      <div
        class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
      >
        <!-- Header -->
        <div class="bg-amber-50 px-6 py-4 border-b border-amber-200">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <AlertTriangle class="h-6 w-6 text-amber-600" />
            </div>
            <h3 class="ml-3 text-lg font-semibold text-amber-900" id="modal-title">
              Compliance Override Required
            </h3>
          </div>
        </div>

        <!-- Content -->
        <div class="px-6 py-4">
          <p class="text-sm text-gray-700 mb-4">
            The property at <span class="font-medium">{{ propertyAddress }}</span> has expired compliance certificates:
          </p>

          <!-- Expired compliance list -->
          <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <ul class="space-y-1">
              <li
                v-for="type in expiredTypes"
                :key="type"
                class="flex items-center text-sm text-red-800"
              >
                <XCircle class="w-4 h-4 mr-2 text-red-500" />
                {{ formatComplianceType(type) }}
              </li>
            </ul>
          </div>

          <p class="text-sm text-gray-600 mb-4">
            To proceed with this agreement, you must acknowledge that you are aware of the expired compliance
            and provide a reason for continuing.
          </p>

          <!-- Reason input -->
          <div>
            <label for="override-reason" class="block text-sm font-medium text-gray-700 mb-1">
              Reason for override <span class="text-red-500">*</span>
            </label>
            <textarea
              id="override-reason"
              v-model="reason"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              placeholder="e.g., Renewal certificate pending, scheduled for next week..."
            ></textarea>
            <p class="mt-1 text-xs text-gray-500">
              This will be recorded in the audit log for compliance purposes.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!reason.trim()"
            @click="handleConfirm"
          >
            Acknowledge & Continue
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { AlertTriangle, XCircle } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  propertyAddress: string
  expiredTypes: string[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', reason: string): void
}>()

const reason = ref('')

// Reset reason when modal opens
watch(() => props.show, (newVal) => {
  if (newVal) {
    reason.value = ''
  }
})

function formatComplianceType(type: string): string {
  const types: Record<string, string> = {
    'gas_safety': 'Gas Safety Certificate',
    'eicr': 'EICR (Electrical Installation)',
    'epc': 'Energy Performance Certificate (EPC)',
    'council_licence': 'Council Licence',
    'pat_test': 'PAT Test',
    'other': 'Other Compliance'
  }
  return types[type] || type
}

function handleConfirm() {
  if (reason.value.trim()) {
    emit('confirm', reason.value.trim())
  }
}
</script>

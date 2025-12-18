<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="$emit('close')"></div>

      <!-- Center modal -->
      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

      <div class="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
        <!-- Close button -->
        <button @click="$emit('close')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
          <X class="h-6 w-6" />
        </button>

        <div class="sm:flex sm:items-start">
          <!-- Icon -->
          <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 sm:mx-0 sm:h-16 sm:w-16">
            <AlertTriangle class="h-8 w-8 text-orange-600" />
          </div>

          <!-- Content -->
          <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
            <h3 class="text-2xl leading-6 font-bold text-gray-900" id="modal-title">
              Payment Method Required
            </h3>
            <div class="mt-4">
              <p class="text-base text-gray-600 leading-relaxed">
                Please add a payment method to your account before creating references.
              </p>

              <!-- Pricing info box -->
              <div class="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div class="flex items-start">
                  <AlertCircle class="h-5 w-5 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div class="text-sm text-orange-800">
                    <p class="font-semibold mb-1">Credit costs</p>
                    <p>References cost <strong>1 credit</strong> each. Guarantor references cost <strong>0.5 credits</strong> each.</p>
                  </div>
                </div>
              </div>

              <!-- Benefits list -->
              <div class="mt-4 space-y-2">
                <div class="flex items-start text-sm text-gray-600">
                  <Check class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Purchase credits via subscription or credit packs</span>
                </div>
                <div class="flex items-start text-sm text-gray-600">
                  <Check class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Enable auto-recharge to never run out of credits</span>
                </div>
                <div class="flex items-start text-sm text-gray-600">
                  <Check class="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <span>Unused credits never expire</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="mt-6 sm:mt-6 sm:flex sm:flex-row-reverse gap-3">
          <button
            type="button"
            @click="goToBilling"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-6 py-3 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:w-auto sm:text-sm transition-colors"
          >
            Add Payment Method
          </button>
          <button
            type="button"
            @click="$emit('close')"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-6 py-3 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 sm:mt-0 sm:w-auto sm:text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X, AlertTriangle, AlertCircle, Check } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()

const goToBilling = () => {
  emit('close')
  router.push('/billing')
}
</script>

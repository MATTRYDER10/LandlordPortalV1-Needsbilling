<template>
  <div v-if="isOpen" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
    <div class="relative bg-white rounded-lg shadow-xl max-w-md mx-4 p-6 w-full">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Recall Agreement</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-500">
          <X class="h-6 w-6" />
        </button>
      </div>

      <!-- Warning Banner -->
      <div class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div class="flex items-start gap-3">
          <AlertTriangle class="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p class="text-sm font-medium text-amber-800">This agreement has been sent for signing</p>
            <p v-if="signerProgress" class="text-sm text-amber-700 mt-1">
              {{ signerProgress.signed }} of {{ signerProgress.total }} parties have signed.
            </p>
          </div>
        </div>
      </div>

      <!-- What will happen -->
      <div class="mb-6">
        <p class="text-sm text-gray-600 mb-3">Recalling this agreement will:</p>
        <ul class="space-y-2">
          <li class="flex items-start gap-2 text-sm text-gray-600">
            <XCircle class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span>Cancel the current signing process</span>
          </li>
          <li class="flex items-start gap-2 text-sm text-gray-600">
            <XCircle class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span>Invalidate all pending signing links</span>
          </li>
          <li class="flex items-start gap-2 text-sm text-gray-600">
            <FileText class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <span>Create a new draft with your changes</span>
          </li>
          <li class="flex items-start gap-2 text-sm text-gray-600">
            <Archive class="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <span>Keep the original as "Cancelled" in history</span>
          </li>
        </ul>
      </div>

      <!-- Property info -->
      <div class="p-3 bg-gray-50 rounded-lg mb-6">
        <p class="text-sm font-medium text-gray-900">{{ propertyAddress }}</p>
      </div>

      <!-- Action buttons -->
      <div class="flex justify-end gap-3">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          @click="$emit('confirm')"
          :disabled="loading"
          class="px-4 py-2 text-white font-medium bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
        >
          {{ loading ? 'Recalling...' : 'Recall and Edit' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X, AlertTriangle, XCircle, FileText, Archive } from 'lucide-vue-next'

interface SignerProgress {
  signed: number
  total: number
}

defineProps<{
  isOpen: boolean
  propertyAddress: string
  signerProgress?: SignerProgress | null
  loading?: boolean
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()
</script>

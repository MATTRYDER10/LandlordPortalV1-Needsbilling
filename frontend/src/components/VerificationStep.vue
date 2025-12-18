<template>
  <div class="bg-white rounded-lg shadow-lg p-8">
    <!-- Step Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-2xl font-bold text-gray-900">{{ title }}</h3>
        <span v-if="completed" class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <CheckCircle class="w-4 h-4 mr-1" />
          Completed
        </span>
      </div>
      <p v-if="description" class="text-gray-600">{{ description }}</p>
    </div>

    <!-- Step Content -->
    <div class="mb-8">
      <slot></slot>
    </div>

    <!-- Notes Section -->
    <div v-if="showNotes" class="mb-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Notes (Optional)
      </label>
      <textarea
        :value="notes"
        @input="$emit('update:notes', ($event.target as HTMLTextAreaElement).value)"
        rows="3"
        placeholder="Add any notes or observations about this verification step..."
        class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
      ></textarea>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center justify-between pt-6 border-t">
      <button
        v-if="showPrevious"
        @click="$emit('previous')"
        class="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
      >
        ← Previous
      </button>
      <div v-else></div>

      <div class="flex gap-3">
        <button
          v-if="showSave"
          @click="$emit('save')"
          :disabled="saving"
          class="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save Progress' }}
        </button>
        <button
          @click="$emit('next')"
          :disabled="!canProceed || saving"
          class="px-6 py-3 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {{ nextButtonText }}
          <ChevronRight class="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>

    <!-- Cannot Proceed Warning -->
    <div v-if="!canProceed && showCannotProceedWarning" class="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
      <div class="flex">
        <AlertTriangle class="w-5 h-5 text-yellow-400 mr-3" />
        <p class="text-sm text-yellow-800">
          {{ cannotProceedMessage || 'Please complete all required verifications before proceeding.' }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle, ChevronRight, AlertTriangle } from 'lucide-vue-next'

interface Props {
  title: string
  description?: string
  completed?: boolean
  canProceed?: boolean
  showPrevious?: boolean
  showSave?: boolean
  showNotes?: boolean
  notes?: string
  nextButtonText?: string
  saving?: boolean
  cannotProceedMessage?: string
  showCannotProceedWarning?: boolean
}

withDefaults(defineProps<Props>(), {
  description: '',
  completed: false,
  canProceed: true,
  showPrevious: true,
  showSave: true,
  showNotes: true,
  notes: '',
  nextButtonText: 'Next Step',
  saving: false,
  cannotProceedMessage: '',
  showCannotProceedWarning: true
})

defineEmits<{
  'previous': []
  'next': []
  'save': []
  'update:notes': [value: string]
}>()
</script>

<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle, XCircle, AlertTriangle, ChevronRight, Info } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const API_URL = (import.meta.env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3001'
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001')

interface TenantChange {
  id: string
  referencing_skipped: boolean
  referencing_overridden: boolean
  referencing_override_reason: string | null
  incoming_tenants: any[]
}

const props = defineProps<{
  tenantChange: TenantChange
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update', data: any): void
  (e: 'next'): void
}>()

const authStore = useAuthStore()
const isSubmitting = ref(false)
const error = ref('')

const requireReferencing = ref(!props.tenantChange.referencing_skipped)
const showOverrideForm = ref(false)
const overrideReason = ref(props.tenantChange.referencing_override_reason || '')

async function handleSubmit() {
  isSubmitting.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/referencing`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requiresReferencing: requireReferencing.value
        })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save referencing decision')
    }

    emit('next')
  } catch (err: any) {
    error.value = err.message
  } finally {
    isSubmitting.value = false
  }
}

async function handleOverride() {
  if (!overrideReason.value.trim()) {
    error.value = 'Please provide a reason for overriding the referencing requirement'
    return
  }

  isSubmitting.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/override-referencing`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: overrideReason.value
        })
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to override referencing')
    }

    emit('next')
  } catch (err: any) {
    error.value = err.message
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="text-center">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Referencing Decision
      </h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        Do the incoming tenant(s) require referencing before proceeding?
      </p>
    </div>

    <!-- Info Box -->
    <div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
      <div class="flex gap-3">
        <Info class="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div class="text-sm text-blue-700 dark:text-blue-300">
          <p class="font-medium mb-1">PropertyGoose Referencing</p>
          <p>You can reference the incoming tenant(s) through PropertyGoose's internal referencing system. This includes identity verification, credit check, and employment/landlord references.</p>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
        <AlertTriangle class="w-4 h-4" />
        <span class="text-sm">{{ error }}</span>
      </div>
    </div>

    <!-- Options -->
    <div class="space-y-3">
      <label
        class="flex items-start p-4 bg-gray-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        :class="{ 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-900/30': requireReferencing }"
      >
        <input
          v-model="requireReferencing"
          type="radio"
          :value="true"
          name="referencing"
          class="w-4 h-4 mt-1 text-orange-600 border-gray-300 focus:ring-orange-500"
        >
        <div class="ml-3">
          <div class="flex items-center gap-2">
            <CheckCircle class="w-5 h-5 text-green-500" />
            <span class="font-medium text-gray-900 dark:text-white">Yes, reference the incoming tenant(s)</span>
          </div>
          <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Create reference requests for each incoming tenant. The tenant change will proceed once references pass.
          </p>
        </div>
      </label>

      <label
        class="flex items-start p-4 bg-gray-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        :class="{ 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-900/30': !requireReferencing }"
      >
        <input
          v-model="requireReferencing"
          type="radio"
          :value="false"
          name="referencing"
          class="w-4 h-4 mt-1 text-orange-600 border-gray-300 focus:ring-orange-500"
        >
        <div class="ml-3">
          <div class="flex items-center gap-2">
            <XCircle class="w-5 h-5 text-gray-400" />
            <span class="font-medium text-gray-900 dark:text-white">No, skip referencing</span>
          </div>
          <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Proceed without referencing the incoming tenant(s). Use this if you've already referenced them separately.
          </p>
        </div>
      </label>
    </div>

    <!-- Override Option (if referencing is required but user wants to proceed anyway) -->
    <div v-if="requireReferencing && props.tenantChange.incoming_tenants.length > 0" class="pt-4 border-t border-gray-200 dark:border-slate-700">
      <button
        @click="showOverrideForm = !showOverrideForm"
        class="text-sm text-gray-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400"
      >
        Already have external references? Override requirement...
      </button>

      <div v-if="showOverrideForm" class="mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
        <div class="flex items-start gap-3 mb-4">
          <AlertTriangle class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div class="text-sm text-amber-700 dark:text-amber-300">
            <p class="font-medium">Override Referencing Requirement</p>
            <p>You are about to proceed without using PropertyGoose referencing. Please provide a reason for audit purposes.</p>
          </div>
        </div>

        <textarea
          v-model="overrideReason"
          rows="3"
          placeholder="e.g., References completed externally via XYZ agency, reference number ABC123"
          class="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        ></textarea>

        <button
          @click="handleOverride"
          :disabled="isSubmitting || !overrideReason.trim()"
          class="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isSubmitting ? 'Saving...' : 'Override & Continue' }}
        </button>
      </div>
    </div>

    <!-- Submit Button -->
    <div class="flex justify-end pt-4">
      <button
        @click="handleSubmit"
        :disabled="isSubmitting"
        class="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        {{ isSubmitting ? 'Saving...' : 'Continue' }}
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FileText, Send, AlertTriangle, ChevronRight, Eye } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const API_URL = (import.meta.env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3001'
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001')

interface TenantChange {
  id: string
  changeover_date: string | null
  incoming_tenants: any[]
  outgoing_tenant_ids: string[]
  addendum_sent_at: string | null
}

const props = defineProps<{
  tenantChange: TenantChange
  propertyAddress: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'next'): void
}>()

const authStore = useAuthStore()
const isSending = ref(false)
const error = ref('')

const addendumSent = ref(!!props.tenantChange.addendum_sent_at)

async function sendForSigning() {
  isSending.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/send-for-signing`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to send addendum for signing')
    }

    addendumSent.value = true
    emit('next')
  } catch (err: any) {
    error.value = err.message
  } finally {
    isSending.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="text-center">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Addendum Review
      </h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        Review the change of tenant addendum before sending for signatures.
      </p>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
        <AlertTriangle class="w-4 h-4" />
        <span class="text-sm">{{ error }}</span>
      </div>
    </div>

    <!-- Addendum Preview -->
    <div class="p-6 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
      <div class="flex items-start gap-4 mb-6">
        <div class="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
          <FileText class="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 dark:text-white">Change of Tenant Addendum</h4>
          <p class="text-sm text-gray-500 dark:text-slate-400">Legally binding addendum to the tenancy agreement</p>
        </div>
      </div>

      <div class="space-y-4 text-sm">
        <div class="p-3 bg-white dark:bg-slate-700 rounded-lg">
          <p class="text-gray-500 dark:text-slate-400">Property Address</p>
          <p class="font-medium text-gray-900 dark:text-white">{{ propertyAddress }}</p>
        </div>

        <div class="p-3 bg-white dark:bg-slate-700 rounded-lg">
          <p class="text-gray-500 dark:text-slate-400">Changeover Date</p>
          <p class="font-medium text-gray-900 dark:text-white">
            {{ tenantChange.changeover_date ? new Date(tenantChange.changeover_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set' }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
            <p class="text-red-600 dark:text-red-400 text-xs uppercase font-medium mb-1">Outgoing</p>
            <p class="font-medium text-gray-900 dark:text-white">
              {{ tenantChange.outgoing_tenant_ids.length }} tenant(s)
            </p>
          </div>
          <div class="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <p class="text-green-600 dark:text-green-400 text-xs uppercase font-medium mb-1">Incoming</p>
            <p class="font-medium text-gray-900 dark:text-white">
              {{ tenantChange.incoming_tenants.length }} tenant(s)
            </p>
          </div>
        </div>
      </div>

      <!-- Document Contents Preview -->
      <div class="mt-6 pt-6 border-t border-gray-200 dark:border-slate-600">
        <h5 class="font-medium text-gray-900 dark:text-white mb-3">The addendum will include:</h5>
        <ul class="space-y-2 text-sm text-gray-600 dark:text-slate-300">
          <li class="flex items-start gap-2">
            <span class="text-orange-500">1.</span>
            Reference to the original tenancy agreement
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-500">2.</span>
            Names of all outgoing and incoming tenants
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-500">3.</span>
            Effective date of the change ({{ tenantChange.changeover_date ? new Date(tenantChange.changeover_date).toLocaleDateString('en-GB') : 'TBC' }})
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-500">4.</span>
            Confirmation of ongoing deposit protection
          </li>
          <li class="flex items-start gap-2">
            <span class="text-orange-500">5.</span>
            Signature blocks for all parties
          </li>
        </ul>
      </div>
    </div>

    <!-- Signers Info -->
    <div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
      <h5 class="font-medium text-blue-700 dark:text-blue-300 mb-2">Signatures Required</h5>
      <p class="text-sm text-blue-600 dark:text-blue-400">
        The addendum will be sent to all parties for electronic signature:
      </p>
      <ul class="mt-2 text-sm text-blue-700 dark:text-blue-300 space-y-1">
        <li>• {{ tenantChange.outgoing_tenant_ids.length }} outgoing tenant(s)</li>
        <li>• {{ tenantChange.incoming_tenants.length }} incoming tenant(s)</li>
        <li>• Remaining tenant(s) on the tenancy</li>
        <li>• Landlord/Agent representative</li>
      </ul>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3">
      <button
        v-if="!addendumSent"
        @click="sendForSigning"
        :disabled="isSending"
        class="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
      >
        <Send class="w-4 h-4" />
        {{ isSending ? 'Sending...' : 'Send for Signing' }}
      </button>

      <button
        v-else
        @click="emit('next')"
        class="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
      >
        Continue
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

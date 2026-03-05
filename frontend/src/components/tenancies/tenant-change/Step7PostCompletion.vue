<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CheckCircle, Circle, ExternalLink, AlertTriangle, PartyPopper, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'

const API_URL = (import.meta.env.DEV && typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:3001'
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001')

interface TenantChange {
  id: string
  checklist_deposit_updated: boolean
  checklist_deposit_updated_at: string | null
  checklist_prescribed_info_sent: boolean
  checklist_prescribed_info_sent_at: string | null
  checklist_deposit_share_confirmed: boolean
  checklist_deposit_share_confirmed_at: string | null
  completed_at: string | null
  status: string
}

const props = defineProps<{
  tenantChange: TenantChange
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update', data: any): void
  (e: 'close'): void
  (e: 'finalize'): void
}>()

const authStore = useAuthStore()
const toast = useToast()
const isUpdating = ref(false)
const isFinalizing = ref(false)
const error = ref('')

// Track if tenant change is already finalized (tenants updated)
const isFinalized = computed(() => props.tenantChange.status === 'completed')

const checklistItems = ref([
  {
    key: 'deposit_updated',
    label: 'Update Deposit with TDS',
    description: 'Update the tenancy deposit details with your deposit protection scheme (DPS, MyDeposits, TDS)',
    completed: props.tenantChange.checklist_deposit_updated,
    completedAt: props.tenantChange.checklist_deposit_updated_at,
    externalLink: true
  },
  {
    key: 'prescribed_info_sent',
    label: 'Send Prescribed Information',
    description: 'Send the deposit prescribed information to the incoming tenant(s)',
    completed: props.tenantChange.checklist_prescribed_info_sent,
    completedAt: props.tenantChange.checklist_prescribed_info_sent_at,
    externalLink: false
  },
  {
    key: 'deposit_share_confirmed',
    label: 'Confirm Deposit Share',
    description: 'Confirm the deposit share arrangement between all current tenants',
    completed: props.tenantChange.checklist_deposit_share_confirmed,
    completedAt: props.tenantChange.checklist_deposit_share_confirmed_at,
    externalLink: false
  }
])

const allComplete = computed(() => checklistItems.value.every(item => item.completed))

async function toggleItem(key: string) {
  const item = checklistItems.value.find(i => i.key === key)
  if (!item) return

  isUpdating.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const updates: Record<string, boolean> = {}
    updates[key] = !item.completed

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/checklist`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to update checklist')
    }

    const result = await response.json()

    // Update local state
    item.completed = !item.completed
    item.completedAt = item.completed ? new Date().toISOString() : null

    emit('update', result.tenantChange)
  } catch (err: any) {
    error.value = err.message
  } finally {
    isUpdating.value = false
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// TDS Portal links
const tdsLinks = {
  dps: 'https://www.depositprotection.com/',
  mydeposits: 'https://www.mydeposits.co.uk/',
  tds: 'https://www.tenancydepositscheme.com/'
}

// Finalize the tenant change - uploads addendum, sends to signers, updates tenants
async function finalizeChange() {
  if (!allComplete.value) {
    error.value = 'Please complete all checklist items before finalizing'
    return
  }

  isFinalizing.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(
      `${API_URL}/api/tenant-change/${props.tenantChange.id}/finalize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to finalize tenant change')
    }

    const result = await response.json()
    toast.success('Tenant change finalized successfully!')
    emit('update', result.tenantChange)
    emit('finalize')
  } catch (err: any) {
    error.value = err.message
  } finally {
    isFinalizing.value = false
  }
}

// Watch for changes to keep checklistItems in sync
watch(() => props.tenantChange, (tc) => {
  checklistItems.value[0].completed = tc.checklist_deposit_updated
  checklistItems.value[0].completedAt = tc.checklist_deposit_updated_at
  checklistItems.value[1].completed = tc.checklist_prescribed_info_sent
  checklistItems.value[1].completedAt = tc.checklist_prescribed_info_sent_at
  checklistItems.value[2].completed = tc.checklist_deposit_share_confirmed
  checklistItems.value[2].completedAt = tc.checklist_deposit_share_confirmed_at
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Success Banner - Only show when fully finalized -->
    <div v-if="isFinalized" class="p-6 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800 text-center">
      <div class="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
        <PartyPopper class="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      <h3 class="text-lg font-semibold text-green-700 dark:text-green-300 mb-2">
        Tenant Change Complete!
      </h3>
      <p class="text-sm text-green-600 dark:text-green-400">
        The tenancy records have been updated. The signed addendum has been uploaded and sent to all parties.
        {{ tenantChange.completed_at ? `Completed on ${formatDate(tenantChange.completed_at)}` : '' }}
      </p>
    </div>

    <!-- Pending Banner - Show until finalized -->
    <div v-else class="p-6 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800 text-center">
      <div class="w-16 h-16 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle class="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 class="text-lg font-semibold text-amber-700 dark:text-amber-300 mb-2">
        Final Steps Required
      </h3>
      <p class="text-sm text-amber-600 dark:text-amber-400">
        Complete the checklist below, then click "Finalize" to update the tenancy records, upload the addendum, and notify all parties.
      </p>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
        <AlertTriangle class="w-4 h-4" />
        <span class="text-sm">{{ error }}</span>
      </div>
    </div>

    <!-- Post-Completion Checklist -->
    <div>
      <h4 class="font-semibold text-gray-900 dark:text-white mb-4">Post-Completion Checklist</h4>
      <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">
        Complete these tasks to ensure full compliance with deposit protection requirements.
      </p>

      <div class="space-y-3">
        <div
          v-for="item in checklistItems"
          :key="item.key"
          class="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg"
        >
          <div class="flex items-start gap-3">
            <button
              @click="toggleItem(item.key)"
              :disabled="isUpdating"
              class="mt-0.5 flex-shrink-0 disabled:opacity-50"
            >
              <CheckCircle
                v-if="item.completed"
                class="w-6 h-6 text-green-500"
              />
              <Circle
                v-else
                class="w-6 h-6 text-gray-300 dark:text-slate-600 hover:text-orange-500"
              />
            </button>

            <div class="flex-1">
              <div class="flex items-center gap-2">
                <p
                  class="font-medium"
                  :class="item.completed ? 'text-gray-400 dark:text-slate-500 line-through' : 'text-gray-900 dark:text-white'"
                >
                  {{ item.label }}
                </p>
                <a
                  v-if="item.key === 'deposit_updated'"
                  href="https://www.depositprotection.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-orange-500 hover:text-orange-600"
                >
                  <ExternalLink class="w-4 h-4" />
                </a>
              </div>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
                {{ item.description }}
              </p>
              <p v-if="item.completedAt" class="text-xs text-green-500 mt-1">
                Completed {{ formatDate(item.completedAt) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TDS Portal Links -->
    <div class="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
      <h5 class="font-medium text-blue-700 dark:text-blue-300 mb-3">Deposit Protection Portals</h5>
      <div class="flex flex-wrap gap-3">
        <a
          v-for="(url, name) in tdsLinks"
          :key="name"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          class="px-3 py-1.5 bg-white dark:bg-slate-700 rounded border border-blue-200 dark:border-blue-700 text-sm text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1"
        >
          {{ name.toUpperCase() }}
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex justify-center gap-3">
      <!-- Finalize Button - Only show when not finalized -->
      <button
        v-if="!isFinalized"
        @click="finalizeChange"
        :disabled="!allComplete || isFinalizing"
        class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <Loader2 v-if="isFinalizing" class="w-4 h-4 animate-spin" />
        <CheckCircle v-else class="w-4 h-4" />
        {{ isFinalizing ? 'Finalizing...' : 'Finalize & Complete' }}
      </button>

      <!-- Done Button - Only show when finalized -->
      <button
        v-if="isFinalized"
        @click="emit('close')"
        class="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
      >
        Done
      </button>

      <!-- Hint when not all items complete -->
      <p v-if="!isFinalized && !allComplete" class="text-sm text-gray-500 dark:text-slate-400 self-center">
        Complete all checklist items to finalize
      </p>
    </div>
  </div>
</template>

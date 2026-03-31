<template>
  <div class="space-y-6">
    <!-- JMI Branded Header -->
    <div class="rounded-lg border-2 border-[#0891B2] bg-gradient-to-br from-[#0891B2]/5 to-[#0E7490]/10 dark:from-[#0891B2]/10 dark:to-[#0E7490]/20 overflow-hidden">
      <div class="px-6 py-4 bg-white dark:bg-slate-800 border-b border-[#0891B2]/30 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#0891B2]">
            <Zap class="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-[#0E7490] dark:text-white">Just Move In</h3>
            <p class="text-xs text-gray-500 dark:text-slate-400">Utility Switching Service</p>
          </div>
        </div>
        <a
          href="https://justmovein.com"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-[#0E7490] hover:text-[#0891B2] dark:text-slate-300 dark:hover:text-[#0891B2] transition-colors flex items-center gap-1"
        >
          Learn more
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>
      <div class="p-4">
        <p class="text-sm text-gray-600 dark:text-slate-400">
          Connect your Just Move In account to notify utility providers when tenants move in or out, directly from tenancy records.
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="w-8 h-8 animate-spin text-[#0891B2]" />
    </div>

    <!-- Main Panel -->
    <div v-else class="bg-white dark:bg-slate-800 rounded-lg border border-[#0891B2]/30 shadow p-6">
      <div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-[#0891B2]/20">
            <Key class="w-4 h-4 text-[#0891B2] dark:text-[#22D3EE]" />
          </div>
          <div>
            <h4 class="text-md font-semibold text-[#0E7490] dark:text-white">API Connection</h4>
            <p class="text-sm text-gray-500 dark:text-slate-400">
              Enter your JMI API key to connect your account.
            </p>
          </div>
        </div>
        <div v-if="status?.configured" class="flex items-center gap-2">
          <span
            class="px-2 py-1 rounded-full text-xs font-medium"
            :class="status.lastTestStatus === 'success'
              ? 'bg-[#0891B2]/20 text-[#0E7490] dark:bg-[#22D3EE]/30 dark:text-[#22D3EE]'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'"
          >
            {{ status.lastTestStatus === 'success' ? 'Connected' : 'Needs Testing' }}
          </span>
        </div>
      </div>

      <!-- Saved Config Display -->
      <div v-if="status?.configured && !editMode" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
          <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
            <span class="text-gray-900 dark:text-white font-mono">{{ status.maskedApiKey || '••••••••••••••••••••' }}</span>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Environment</label>
          <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
            <span class="text-gray-900 dark:text-white capitalize">{{ status.environment || 'sandbox' }}</span>
          </div>
        </div>

        <!-- Connection Info -->
        <div v-if="status.lastTestedAt" class="text-xs text-gray-500 dark:text-slate-400">
          Last tested: {{ formatDate(status.lastTestedAt) }}
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-between pt-4 border-t dark:border-slate-700">
          <div class="flex gap-3">
            <button
              type="button"
              @click="editMode = true"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Edit Settings
            </button>
            <button
              type="button"
              @click="handleTestConnection"
              :disabled="testing"
              class="px-4 py-2 text-sm font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-2"
            >
              <Loader2 v-if="testing" class="w-4 h-4 animate-spin" />
              <Wifi v-else class="w-4 h-4" />
              Test Connection
            </button>
          </div>
          <button
            type="button"
            @click="showRemoveConfirm = true"
            class="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
          >
            Remove Integration
          </button>
        </div>

        <!-- Test Result -->
        <div v-if="testResult" class="mt-3 p-3 rounded-md text-sm" :class="testResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'">
          {{ testResult.message }}
        </div>
      </div>

      <!-- Edit / New Config Form -->
      <div v-else class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
          <div class="mt-1 relative">
            <input
              v-model="apiKeyInput"
              :type="showApiKey ? 'text' : 'password'"
              placeholder="Enter your JMI API key..."
              class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-[#0891B2] focus:border-[#0891B2] dark:bg-slate-900 dark:text-white text-sm pr-10"
            />
            <button
              type="button"
              @click="showApiKey = !showApiKey"
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              <EyeOff v-if="showApiKey" class="w-4 h-4" />
              <Eye v-else class="w-4 h-4" />
            </button>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Contact Just Move In to obtain your API key for the partner integration.
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Environment</label>
          <select
            v-model="environmentInput"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-[#0891B2] focus:border-[#0891B2] dark:bg-slate-900 dark:text-white text-sm"
          >
            <option value="sandbox">Sandbox (Testing)</option>
            <option value="production">Production</option>
          </select>
        </div>

        <!-- Error -->
        <div v-if="error" class="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 text-sm">
          {{ error }}
        </div>

        <!-- Form Actions -->
        <div class="flex items-center gap-3 pt-2">
          <button
            type="button"
            @click="handleSaveConfig"
            :disabled="saving || !apiKeyInput.trim()"
            class="px-4 py-2 text-sm font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-2"
          >
            <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
            Save Settings
          </button>
          <button
            v-if="status?.configured"
            type="button"
            @click="editMode = false; apiKeyInput = ''"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Remove Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showRemoveConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showRemoveConfirm = false">
        <div class="bg-white dark:bg-slate-900 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove Just Move In Integration</h3>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">
            Are you sure you want to remove the Just Move In integration? This will disconnect your account but will not affect existing move records.
          </p>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              @click="showRemoveConfirm = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleRemoveIntegration"
              :disabled="removing"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-2"
            >
              <Loader2 v-if="removing" class="w-4 h-4 animate-spin" />
              Remove
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Zap, ExternalLink, Key, Loader2, Wifi, Eye, EyeOff } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { authFetch } from '@/lib/authFetch'
import { API_URL } from '@/lib/apiUrl'

const authStore = useAuthStore()

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const removing = ref(false)
const editMode = ref(false)
const showApiKey = ref(false)
const showRemoveConfirm = ref(false)
const apiKeyInput = ref('')
const environmentInput = ref('sandbox')
const error = ref('')
const testResult = ref<{ success: boolean; message: string } | null>(null)

const status = ref<{
  configured: boolean
  maskedApiKey: string | null
  environment: string
  connectedAt: string | null
  lastTestedAt: string | null
  lastTestStatus: string | null
} | null>(null)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function fetchStatus() {
  try {
    const response = await authFetch(`${API_URL}/api/settings/jmi`, {
      token: authStore.session?.access_token || undefined
    })
    if (response.ok) {
      status.value = await response.json()
      if (status.value?.environment) {
        environmentInput.value = status.value.environment
      }
    }
  } catch (err) {
    console.error('[JMI Settings] Error fetching status:', err)
  } finally {
    loading.value = false
  }
}

async function handleSaveConfig() {
  error.value = ''
  saving.value = true
  try {
    const response = await authFetch(`${API_URL}/api/settings/jmi`, {
      method: 'POST',
      token: authStore.session?.access_token || undefined,
      body: JSON.stringify({
        apiKey: apiKeyInput.value.trim(),
        environment: environmentInput.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      error.value = data.error || 'Failed to save settings'
      return
    }

    apiKeyInput.value = ''
    editMode.value = false
    await fetchStatus()
  } catch (err) {
    error.value = 'Failed to save settings'
  } finally {
    saving.value = false
  }
}

async function handleTestConnection() {
  testing.value = true
  testResult.value = null
  try {
    const response = await authFetch(`${API_URL}/api/settings/jmi/test`, {
      method: 'POST',
      token: authStore.session?.access_token || undefined
    })

    const data = await response.json()

    if (response.ok) {
      testResult.value = { success: true, message: data.message }
      await fetchStatus()
    } else {
      testResult.value = { success: false, message: data.error || 'Connection test failed' }
    }
  } catch (err) {
    testResult.value = { success: false, message: 'Connection test failed' }
  } finally {
    testing.value = false
  }
}

async function handleRemoveIntegration() {
  removing.value = true
  try {
    const response = await authFetch(`${API_URL}/api/settings/jmi`, {
      method: 'DELETE',
      token: authStore.session?.access_token || undefined
    })

    if (response.ok) {
      showRemoveConfirm.value = false
      status.value = null
      editMode.value = false
      await fetchStatus()
    }
  } catch (err) {
    console.error('[JMI Settings] Error removing integration:', err)
  } finally {
    removing.value = false
  }
}

onMounted(fetchStatus)
</script>

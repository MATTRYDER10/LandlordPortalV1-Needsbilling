<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Reposit (Deposit Replacement)</h3>
      <p class="mt-1 text-sm text-gray-600 dark:text-slate-400">
        Connect your Reposit account to offer deposit replacement to tenants.
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="w-8 h-8 animate-spin text-primary" />
    </div>

    <!-- Configuration Panel -->
    <div v-else class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
      <div class="flex items-start justify-between mb-6">
        <div>
          <h4 class="text-md font-semibold text-gray-900 dark:text-white">Reposit Integration</h4>
          <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Reposit provides deposit replacement insurance for landlords.
          </p>
        </div>
        <div v-if="status?.configured" class="flex items-center gap-2">
          <span
            class="px-2 py-1 rounded-full text-xs font-medium"
            :class="status.lastTestStatus === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'"
          >
            {{ status.lastTestStatus === 'success' ? 'Connected' : 'Needs Testing' }}
          </span>
        </div>
      </div>

      <!-- Saved Credentials Display (read-only) -->
      <div v-if="status?.configured && !editMode" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Supplier ID</label>
            <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
              <span class="text-gray-900 dark:text-white font-mono">{{ status.supplierId }}</span>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Environment</label>
            <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
              <span class="text-gray-900 dark:text-white">{{ status.environment === 'live' ? 'Live (Production)' : 'Sandbox (Testing)' }}</span>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Referrer Token</label>
          <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
            <span class="text-gray-900 dark:text-white font-mono">{{ status.maskedReferrerToken || '••••••••••••••••••••' }}</span>
          </div>
        </div>

        <div v-if="status.defaultAgentId">
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Default Agent</label>
          <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
            <span class="text-gray-900 dark:text-white font-mono">{{ status.defaultAgentId }}</span>
          </div>
        </div>

        <div class="flex items-center justify-between pt-4 border-t dark:border-slate-700">
          <div class="flex gap-3">
            <button
              type="button"
              @click="editMode = true"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Edit Credentials
            </button>
            <button
              type="button"
              @click="testConnection"
              :disabled="testing"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              <span v-if="testing" class="flex items-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                Testing...
              </span>
              <span v-else>Test Connection</span>
            </button>
          </div>
          <button
            type="button"
            @click="removeIntegration"
            :disabled="removing"
            class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            {{ removing ? 'Removing...' : 'Remove Integration' }}
          </button>
        </div>

        <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
          {{ error }}
        </div>
        <div v-if="success" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
          {{ success }}
        </div>
      </div>

      <!-- Edit Form -->
      <form v-else @submit.prevent="saveCredentials" class="space-y-4" data-form-type="other">
        <!-- Hidden fields to trap browser autofill -->
        <input type="text" name="trap-username" style="display:none" tabindex="-1" autocomplete="username" />
        <input type="password" name="trap-password" style="display:none" tabindex="-1" autocomplete="current-password" />

        <div>
          <label for="reposit-supplier-id" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Supplier ID</label>
          <input
            id="reposit-supplier-id"
            v-model="form.supplierId"
            name="reposit-supplier-id"
            type="text"
            required
            autocomplete="off"
            data-lpignore="true"
            data-1p-ignore
            class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
            placeholder="e.g. sup_xxxxx or org_xxxxx"
          />
        </div>

        <div>
          <label for="reposit-referrer-token" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Referrer Token</label>
          <div class="mt-1 relative">
            <input
              id="reposit-referrer-token"
              v-model="form.referrerToken"
              name="reposit-referrer-token"
              :type="showReferrerToken ? 'text' : 'password'"
              :required="!status?.configured"
              autocomplete="off"
              data-lpignore="true"
              data-1p-ignore
              class="block w-full px-3 py-2 pr-20 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
              :placeholder="status?.configured ? '••••••••••••••••••••' : 'Enter your Referrer Token'"
            />
            <button
              type="button"
              @click="showReferrerToken = !showReferrerToken"
              class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              <Eye v-if="!showReferrerToken" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
          </div>
          <p v-if="status?.configured" class="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Leave blank to keep existing token
          </p>
        </div>

        <div>
          <label for="reposit-api-key" class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
          <div class="mt-1 relative">
            <input
              id="reposit-api-key"
              v-model="form.apiKey"
              name="reposit-api-key"
              :type="showApiKey ? 'text' : 'password'"
              :required="!status?.configured"
              autocomplete="off"
              data-lpignore="true"
              data-1p-ignore
              class="block w-full px-3 py-2 pr-20 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
              :placeholder="status?.configured ? '••••••••••••••••••••' : 'Enter your API Key'"
            />
            <button
              type="button"
              @click="showApiKey = !showApiKey"
              class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              <Eye v-if="!showApiKey" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
          </div>
          <p v-if="status?.configured" class="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Leave blank to keep existing key
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Environment</label>
          <div class="flex gap-4">
            <label class="flex items-center">
              <input
                type="radio"
                v-model="form.environment"
                value="sandbox"
                class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600"
              />
              <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Sandbox (Testing)</span>
            </label>
            <label class="flex items-center">
              <input
                type="radio"
                v-model="form.environment"
                value="live"
                class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600"
              />
              <span class="ml-2 text-sm text-gray-700 dark:text-slate-300">Live (Production)</span>
            </label>
          </div>
        </div>

        <!-- Agent Selector -->
        <div v-if="agents.length > 0">
          <label for="reposit-default-agent" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Default Agent</label>
          <select
            id="reposit-default-agent"
            v-model="form.defaultAgentId"
            class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
          >
            <option value="">Select an agent (optional)</option>
            <option v-for="agent in agents" :key="agent.id" :value="agent.id">
              {{ agent.name || agent.id }}
            </option>
          </select>
          <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Agent to use when creating Reposits
          </p>
        </div>

        <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
          {{ error }}
        </div>

        <div v-if="success" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
          {{ success }}
        </div>

        <div class="flex items-center justify-between pt-4 border-t dark:border-slate-700">
          <div class="flex gap-3">
            <button
              type="submit"
              :disabled="saving"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Save Credentials' }}
            </button>
            <button
              v-if="editMode"
              type="button"
              @click="cancelEdit"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      <!-- Last tested info -->
      <div v-if="status?.lastTestedAt" class="mt-4 pt-4 border-t dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400">
        Last tested: {{ formatDateTime(status.lastTestedAt) }}
        <span :class="status.lastTestStatus === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
          ({{ status.lastTestStatus === 'success' ? 'Passed' : 'Failed' }})
        </span>
      </div>
    </div>

    <!-- Info Box -->
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <Info class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h5 class="text-sm font-medium text-blue-800 dark:text-blue-400">About Reposit</h5>
          <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Reposit is a deposit replacement product. Instead of paying a full deposit, tenants pay a smaller fee
            and Reposit provides insurance coverage to landlords for the same amount as a traditional deposit.
          </p>
          <p class="text-sm text-blue-700 dark:text-blue-300 mt-2">
            To be eligible for Reposit, tenants must pass identity verification, affordability checks (income >= 30x monthly rent),
            credit checks (no CCJ/IVA/bankruptcy), and Right to Rent verification.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import {
  Eye,
  EyeOff,
  Loader2,
  Info
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const authStore = useAuthStore()

// State
const loading = ref(true)
const status = ref<{
  configured: boolean
  supplierId: string | null
  environment: string
  maskedReferrerToken: string | null
  defaultAgentId: string | null
  connectedAt: string | null
  lastTestedAt: string | null
  lastTestStatus: string | null
} | null>(null)

const form = ref({
  supplierId: '',
  referrerToken: '',
  apiKey: '',
  environment: 'sandbox',
  defaultAgentId: ''
})

const agents = ref<Array<{ id: string; name?: string }>>([])
const showReferrerToken = ref(false)
const showApiKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const removing = ref(false)
const editMode = ref(false)
const error = ref('')
const success = ref('')

// Format datetime
const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Fetch Reposit settings
const fetchSettings = async () => {
  loading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/reposit`, { headers })

    if (response.ok) {
      const data = await response.json()
      status.value = data

      if (data.configured) {
        form.value.supplierId = data.supplierId || ''
        form.value.environment = data.environment || 'sandbox'
        form.value.defaultAgentId = data.defaultAgentId || ''
      }
    }
  } catch (err) {
    console.error('Failed to fetch Reposit settings:', err)
  } finally {
    loading.value = false
  }
}

// Fetch available agents
const fetchAgents = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    }

    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/reposit/agents`, { headers })

    if (response.ok) {
      const data = await response.json()
      agents.value = data.agents || []
    }
  } catch (err) {
    console.error('Failed to fetch agents:', err)
  }
}

// Save credentials
const saveCredentials = async () => {
  saving.value = true
  error.value = ''
  success.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const payload: any = {
      supplierId: form.value.supplierId,
      environment: form.value.environment,
      defaultAgentId: form.value.defaultAgentId || undefined
    }

    if (form.value.referrerToken) {
      payload.referrerToken = form.value.referrerToken
    }
    if (form.value.apiKey) {
      payload.apiKey = form.value.apiKey
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/reposit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()

    if (response.ok) {
      success.value = 'Credentials saved successfully'
      form.value.referrerToken = ''
      form.value.apiKey = ''
      editMode.value = false
      await fetchSettings()
      await fetchAgents()
    } else {
      error.value = responseData.error || 'Failed to save credentials'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to save credentials'
  } finally {
    saving.value = false
  }
}

// Cancel edit
const cancelEdit = () => {
  editMode.value = false
  error.value = ''
  success.value = ''
  if (status.value) {
    form.value.supplierId = status.value.supplierId || ''
    form.value.environment = status.value.environment || 'sandbox'
    form.value.defaultAgentId = status.value.defaultAgentId || ''
  }
  form.value.referrerToken = ''
  form.value.apiKey = ''
}

// Test connection
const testConnection = async () => {
  testing.value = true
  error.value = ''
  success.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/reposit/test`, {
      method: 'POST',
      headers
    })

    const data = await response.json()

    if (response.ok && data.success) {
      success.value = data.message || 'Connection successful!'
      await fetchSettings()
      await fetchAgents()
    } else {
      error.value = data.error || 'Connection test failed'
    }
  } catch (err: any) {
    error.value = err.message || 'Connection test failed'
  } finally {
    testing.value = false
  }
}

// Remove integration
const removeIntegration = async () => {
  if (!confirm('Are you sure you want to remove the Reposit integration?')) return

  removing.value = true
  error.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    }

    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/reposit`, {
      method: 'DELETE',
      headers
    })

    if (response.ok) {
      status.value = null
      form.value = {
        supplierId: '',
        referrerToken: '',
        apiKey: '',
        environment: 'sandbox',
        defaultAgentId: ''
      }
      agents.value = []
      success.value = 'Integration removed successfully'
    } else {
      const data = await response.json()
      error.value = data.error || 'Failed to remove integration'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to remove integration'
  } finally {
    removing.value = false
  }
}

onMounted(async () => {
  await fetchSettings()
  if (status.value?.configured) {
    await fetchAgents()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header with Logo -->
    <div class="flex items-center gap-4">
      <img src="/reposit-logo.png" alt="Reposit" class="h-8 w-auto" />
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Deposit Replacement</h3>
        <p class="mt-0.5 text-sm text-gray-600 dark:text-slate-400">
          Offer tenants a deposit-free move-in experience powered by Reposit.
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="w-8 h-8 animate-spin text-primary" />
    </div>

    <!-- Not Configured -->
    <div v-else-if="!status?.configured" class="space-y-6">
      <!-- Request Integration Card -->
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <div class="text-center max-w-md mx-auto py-4">
          <div class="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail class="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Get Started with Reposit</h4>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-6">
            To enable deposit replacement for your tenancies, request integration credentials from Reposit.
            Once approved, you'll receive an API key to enter below.
          </p>
          <button
            type="button"
            @click="requestIntegration"
            :disabled="requestingIntegration"
            class="px-6 py-3 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            <Loader2 v-if="requestingIntegration" class="w-4 h-4 animate-spin" />
            <Send v-else class="w-4 h-4" />
            {{ requestingIntegration ? 'Sending...' : 'Request Integration from Reposit' }}
          </button>
          <div v-if="requestSuccess" class="mt-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
            {{ requestSuccess }}
          </div>
          <div v-if="requestError" class="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
            {{ requestError }}
          </div>
        </div>

        <!-- Or enter API key manually -->
        <div class="mt-6 pt-6 border-t dark:border-slate-700">
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-4 text-center">
            Already have your API key? Enter it below.
          </p>
          <form @submit.prevent="saveCredentials" class="space-y-4 max-w-md mx-auto" data-form-type="other">
            <input type="text" name="trap-username" style="display:none" tabindex="-1" autocomplete="username" />
            <input type="password" name="trap-password" style="display:none" tabindex="-1" autocomplete="current-password" />

            <div>
              <label for="reposit-account-id" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Account ID</label>
              <div class="mt-1">
                <input
                  id="reposit-account-id"
                  v-model="form.supplierId"
                  name="reposit-account-id"
                  type="text"
                  autocomplete="off"
                  data-lpignore="true"
                  data-1p-ignore
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                  placeholder="e.g. org_abc123"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">The org ID for the agent from Reposit</p>
              </div>
            </div>

            <div>
              <label for="reposit-api-key-setup" class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
              <div class="mt-1 relative">
                <input
                  id="reposit-api-key-setup"
                  v-model="form.apiKey"
                  name="reposit-api-key-setup"
                  :type="showApiKey ? 'text' : 'password'"
                  required
                  autocomplete="off"
                  data-lpignore="true"
                  data-1p-ignore
                  class="block w-full px-3 py-2 pr-20 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                  placeholder="Enter your Reposit API Key"
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
            </div>

            <button
              type="submit"
              :disabled="saving || !form.apiKey || !form.supplierId"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Connect' }}
            </button>

            <div v-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
              {{ error }}
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Configured -->
    <div v-else class="space-y-6">
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <div class="flex items-start justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle class="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h4 class="text-md font-semibold text-gray-900 dark:text-white">Integration Active</h4>
              <p class="text-sm text-gray-500 dark:text-slate-400">
                Reposit deposit replacement is enabled for your tenancies.
              </p>
            </div>
          </div>
          <span
            class="px-2 py-1 rounded-full text-xs font-medium"
            :class="status.lastTestStatus === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'"
          >
            {{ status.lastTestStatus === 'success' ? 'Connected' : 'Needs Testing' }}
          </span>
        </div>

        <!-- API Key (editable) -->
        <div v-if="!editMode" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
            <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
              <span class="text-gray-900 dark:text-white font-mono">••••••••••••••••••••</span>
            </div>
          </div>

          <!-- Agent Selector (read-only display) -->
          <div v-if="status.defaultAgentId && defaultAgentDisplay">
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Default Agent</label>
            <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
              <span class="text-gray-900 dark:text-white">{{ defaultAgentDisplay }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 border-t dark:border-slate-700">
            <div class="flex gap-3">
              <button
                type="button"
                @click="editMode = true"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
              >
                Edit API Key
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
        </div>

        <!-- Edit Form -->
        <form v-else @submit.prevent="saveCredentials" class="space-y-4" data-form-type="other">
          <input type="text" name="trap-username" style="display:none" tabindex="-1" autocomplete="username" />
          <input type="password" name="trap-password" style="display:none" tabindex="-1" autocomplete="current-password" />

          <div>
            <label for="reposit-api-key" class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
            <div class="mt-1 relative">
              <input
                id="reposit-api-key"
                v-model="form.apiKey"
                name="reposit-api-key"
                :type="showApiKey ? 'text' : 'password'"
                autocomplete="off"
                data-lpignore="true"
                data-1p-ignore
                class="block w-full px-3 py-2 pr-20 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                placeholder="Leave blank to keep existing key"
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
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
              Leave blank to keep existing key
            </p>
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
                {{ agent.displayName }}
              </option>
            </select>
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">
              Agent to use when creating Reposits
            </p>
          </div>

          <div class="flex items-center gap-3 pt-4 border-t dark:border-slate-700">
            <button
              type="submit"
              :disabled="saving"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
            <button
              type="button"
              @click="cancelEdit"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Cancel
            </button>
          </div>
        </form>

        <div v-if="error" class="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
          {{ error }}
        </div>
        <div v-if="success" class="mt-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
          {{ success }}
        </div>

        <!-- Last tested info -->
        <div v-if="status?.lastTestedAt" class="mt-4 pt-4 border-t dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400">
          Last tested: {{ formatDateTime(status.lastTestedAt) }}
          <span :class="status.lastTestStatus === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
            ({{ status.lastTestStatus === 'success' ? 'Passed' : 'Failed' }})
          </span>
        </div>
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
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import {
  Eye,
  EyeOff,
  Loader2,
  Info,
  CheckCircle,
  Mail,
  Send
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
  referrerToken: '',
  apiKey: '',
  supplierId: '',
  defaultAgentId: ''
})

const agents = ref<Array<{ id: string; displayName: string }>>([])
const showApiKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const removing = ref(false)
const editMode = ref(false)
const error = ref('')
const success = ref('')
const requestingIntegration = ref(false)
const requestSuccess = ref('')
const requestError = ref('')

const defaultAgentDisplay = computed(() => {
  if (!status.value?.defaultAgentId) return null
  const agent = agents.value.find(a => a.id === status.value?.defaultAgentId)
  return agent?.displayName || status.value.defaultAgentId
})

// Build auth headers
const buildHeaders = (contentType = false): Record<string, string> => {
  const headers: Record<string, string> = {}
  const token = authStore.session?.access_token
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (contentType) headers['Content-Type'] = 'application/json'
  const activeBranchId = localStorage.getItem('activeBranchId')
  if (activeBranchId) headers['X-Branch-Id'] = activeBranchId
  return headers
}

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
    const response = await fetch(`${API_URL}/api/settings/reposit`, { headers: buildHeaders() })
    if (response.ok) {
      const data = await response.json()
      status.value = data
      if (data.configured) {
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
    const response = await fetch(`${API_URL}/api/settings/reposit/agents`, { headers: buildHeaders() })
    if (response.ok) {
      const data = await response.json()
      agents.value = (data.agents || []).map((a: any) => ({
        id: a.id,
        displayName: [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || a.email || a.id
      }))
    }
  } catch (err) {
    console.error('Failed to fetch agents:', err)
  }
}

// Request integration from Reposit
const requestIntegration = async () => {
  requestingIntegration.value = true
  requestSuccess.value = ''
  requestError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_URL}/api/settings/reposit/request-integration`, {
      method: 'POST',
      headers: buildHeaders(true)
    })

    if (response.ok) {
      requestSuccess.value = 'Integration request sent to Reposit. You\'ll receive your credentials via email shortly.'
    } else {
      const data = await response.json()
      requestError.value = data.error || 'Failed to send request'
    }
  } catch (err: any) {
    requestError.value = err.message || 'Failed to send request'
  } finally {
    requestingIntegration.value = false
  }
}

// Save credentials — always sends environment as 'live'
const saveCredentials = async () => {
  saving.value = true
  error.value = ''
  success.value = ''

  try {
    const payload: any = {
      environment: 'live',
      defaultAgentId: form.value.defaultAgentId || undefined
    }

    // Referrer Token is hardcoded server-side — not sent from frontend
    if (form.value.apiKey) payload.apiKey = form.value.apiKey
    if (form.value.supplierId) payload.supplierId = form.value.supplierId
    else if (status.value?.supplierId) payload.supplierId = status.value.supplierId

    const response = await fetch(`${API_URL}/api/settings/reposit`, {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()

    if (response.ok) {
      success.value = 'Settings saved successfully'
      form.value.referrerToken = ''
      form.value.apiKey = ''
      form.value.supplierId = ''
      editMode.value = false
      await fetchSettings()
      await fetchAgents()
    } else {
      error.value = responseData.error || 'Failed to save'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to save'
  } finally {
    saving.value = false
  }
}

// Cancel edit
const cancelEdit = () => {
  editMode.value = false
  error.value = ''
  success.value = ''
  form.value.apiKey = ''
  if (status.value) {
    form.value.defaultAgentId = status.value.defaultAgentId || ''
  }
}

// Test connection
const testConnection = async () => {
  testing.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await fetch(`${API_URL}/api/settings/reposit/test`, {
      method: 'POST',
      headers: buildHeaders(true)
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
    const response = await fetch(`${API_URL}/api/settings/reposit`, {
      method: 'DELETE',
      headers: buildHeaders()
    })

    if (response.ok) {
      status.value = null
      form.value = { apiKey: '', defaultAgentId: '' }
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

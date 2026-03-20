<template>
  <div class="space-y-6">
    <!-- mydeposits Branded Header -->
    <div class="rounded-lg border-2 border-[#00A3E0] bg-gradient-to-br from-[#00A3E0]/5 to-[#003366]/10 dark:from-[#00A3E0]/10 dark:to-[#003366]/20 overflow-hidden">
      <div class="px-6 py-4 bg-white dark:bg-slate-800 border-b border-[#00A3E0]/30 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#00A3E0]">
            <Shield class="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-[#003366] dark:text-white">mydeposits</h3>
            <p class="text-xs text-gray-500 dark:text-slate-400">Tenancy Deposit Protection</p>
          </div>
        </div>
        <a
          href="https://www.mydeposits.co.uk/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-[#003366] hover:text-[#00A3E0] dark:text-slate-300 dark:hover:text-[#00A3E0] transition-colors flex items-center gap-1"
        >
          Learn more
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>
      <div class="p-4">
        <p class="text-sm text-gray-600 dark:text-slate-400">
          Connect your mydeposits account to register deposits directly from tenancy records.
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="w-8 h-8 animate-spin text-[#00A3E0]" />
    </div>

    <!-- Configuration Panel -->
    <div v-else class="bg-white dark:bg-slate-800 rounded-lg border border-[#00A3E0]/30 shadow p-6">
      <div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-[#00A3E0]/20">
            <Shield class="w-4 h-4 text-[#003366] dark:text-[#00A3E0]" />
          </div>
          <div>
            <h4 class="text-md font-semibold text-[#003366] dark:text-white">mydeposits Integration</h4>
            <p class="text-sm text-gray-500 dark:text-slate-400">
              Register and manage deposits with mydeposits.
            </p>
          </div>
        </div>
        <div v-if="status?.configured && status?.authorized" class="flex items-center gap-2">
          <span
            class="px-2 py-1 rounded-full text-xs font-medium"
            :class="status.lastTestStatus === 'success'
              ? 'bg-[#00A3E0]/20 text-[#003366] dark:bg-[#00A3E0]/30 dark:text-[#00A3E0]'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'"
          >
            {{ status.lastTestStatus === 'success' ? 'Connected' : 'Needs Testing' }}
          </span>
        </div>
        <div v-else-if="status?.configured && !status?.authorized" class="flex items-center gap-2">
          <span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
            Needs Linking
          </span>
        </div>
      </div>

      <!-- Configuration Form -->
      <form @submit.prevent="saveCredentials" class="space-y-4" data-form-type="other">
        <!-- Hidden fields to trap browser autofill -->
        <input type="text" name="trap-username" style="display:none" tabindex="-1" autocomplete="username" />
        <input type="password" name="trap-password" style="display:none" tabindex="-1" autocomplete="current-password" />

        <div>
          <label for="mydeposits-client-id" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Client ID</label>
          <input
            id="mydeposits-client-id"
            v-model="form.clientId"
            name="mydeposits-client-id"
            type="text"
            :required="!status?.configured"
            autocomplete="off"
            data-lpignore="true"
            data-1p-ignore
            class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
            :placeholder="status?.clientId || 'Enter your OAuth2 Client ID'"
          />
        </div>

        <div>
          <label for="mydeposits-client-secret" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Client Secret</label>
          <div class="mt-1 relative">
            <input
              id="mydeposits-client-secret"
              v-model="form.clientSecret"
              name="mydeposits-client-secret"
              :type="showSecret ? 'text' : 'password'"
              :required="!status?.configured"
              autocomplete="off"
              data-lpignore="true"
              data-1p-ignore
              class="block w-full px-3 py-2 pr-20 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
              :placeholder="status?.clientSecretHint || 'Enter your OAuth2 Client Secret'"
            />
            <button
              type="button"
              @click="showSecret = !showSecret"
              class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              <Eye v-if="!showSecret" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
          </div>
          <p v-if="status?.configured && !form.clientSecret" class="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Leave blank to keep existing secret
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

        <!-- Member/Branch ID Display (read-only, populated after OAuth) -->
        <div v-if="status?.memberId" class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Member ID</label>
            <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
              <span class="text-gray-900 dark:text-white font-mono">{{ status.memberId }}</span>
            </div>
          </div>
          <div v-if="status?.branchId">
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Branch ID</label>
            <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
              <span class="text-gray-900 dark:text-white font-mono">{{ status.branchId }}</span>
            </div>
          </div>
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

            <!-- Link Account Button -->
            <button
              v-if="status?.configured && !status?.authorized"
              type="button"
              @click="linkAccount"
              :disabled="linking"
              class="px-4 py-2 text-sm font-medium text-white bg-[#00A3E0] hover:bg-[#00A3E0]/90 rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              <ExternalLink class="w-4 h-4" />
              {{ linking ? 'Redirecting...' : 'Link Account' }}
            </button>

            <!-- Test Button -->
            <button
              v-if="status?.configured && status?.authorized"
              type="button"
              @click="testConnection"
              :disabled="testing"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md disabled:opacity-50"
            >
              <span v-if="testing" class="flex items-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                Testing...
              </span>
              <span v-else>Test Connection</span>
            </button>
          </div>
          <button
            v-if="status?.configured"
            type="button"
            @click="removeIntegration"
            :disabled="removing"
            class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            {{ removing ? 'Removing...' : 'Remove Integration' }}
          </button>
        </div>
      </form>

      <!-- Authorization Required Notice -->
      <div v-if="status?.configured && !status?.authorized" class="mt-4 pt-4 border-t dark:border-slate-700">
        <div class="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
          <AlertTriangle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h5 class="text-sm font-medium text-yellow-800 dark:text-yellow-400">Account Linking Required</h5>
            <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Click "Link Account" to authorize PropertyGoose to access your mydeposits account. You'll be redirected to mydeposits to complete the authorization.
            </p>
          </div>
        </div>
      </div>

      <!-- Last tested info -->
      <div v-if="status?.lastTestedAt" class="mt-4 pt-4 border-t dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400">
        Last tested: {{ formatDateTime(status.lastTestedAt) }}
        <span :class="status.lastTestStatus === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
          ({{ status.lastTestStatus === 'success' ? 'Passed' : 'Failed' }})
        </span>
      </div>
    </div>

    <!-- Connected Status Summary -->
    <div v-if="!loading && status?.configured && status?.authorized" class="bg-[#00A3E0]/10 dark:bg-[#00A3E0]/5 rounded-lg border border-[#00A3E0]/30 p-4">
      <h4 class="text-sm font-medium text-[#003366] dark:text-[#00A3E0] mb-3">Connection Status</h4>
      <div class="flex gap-4">
        <div class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-[#00A3E0]/30 rounded-md shadow-sm">
          <Shield class="w-4 h-4 text-[#003366] dark:text-[#00A3E0]" />
          <span class="text-sm font-medium text-[#003366] dark:text-white">
            mydeposits Custodial
          </span>
          <span
            class="w-2 h-2 rounded-full"
            :class="status.lastTestStatus === 'success' ? 'bg-[#00A3E0]' : 'bg-amber-500'"
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import {
  Shield,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  AlertTriangle
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const authStore = useAuthStore()
const route = useRoute()

// Loading state
const loading = ref(true)

// Status
interface Status {
  configured: boolean
  authorized: boolean
  clientId: string | null
  clientSecretHint: string | null
  memberId: string | null
  branchId: string | null
  schemeType: string
  environment: string
  connectedAt: string | null
  lastTestedAt: string | null
  lastTestStatus: string | null
}

const status = ref<Status | null>(null)

// Form
const form = ref({
  clientId: '',
  clientSecret: '',
  schemeType: 'custodial',
  environment: 'sandbox'
})

const showSecret = ref(false)
const saving = ref(false)
const testing = ref(false)
const removing = ref(false)
const linking = ref(false)
const error = ref('')
const success = ref('')

// Code verifier is stored in sessionStorage for PKCE flow

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

// Get headers with branch support
const getHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${authStore.session?.access_token}`,
    'Content-Type': 'application/json'
  }
  const activeBranchId = localStorage.getItem('activeBranchId')
  if (activeBranchId) {
    headers['X-Branch-Id'] = activeBranchId
  }
  return headers
}

// Fetch settings
const fetchSettings = async () => {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/settings/mydeposits`, {
      headers: getHeaders()
    })

    if (response.ok) {
      const data = await response.json()
      status.value = data
      if (data.configured) {
        form.value.clientId = data.clientId || ''
        form.value.schemeType = data.schemeType || 'custodial'
        form.value.environment = data.environment || 'sandbox'
      }
    }
  } catch (err) {
    console.error('Failed to fetch mydeposits settings:', err)
  } finally {
    loading.value = false
  }
}

// Handle OAuth callback
const handleOAuthCallback = async () => {
  const code = route.query.code as string
  const storedVerifier = sessionStorage.getItem('mydeposits_code_verifier')
  const isMyDepositsCallback = route.query.mydeposits_callback === 'true'

  if (code && storedVerifier && isMyDepositsCallback) {
    linking.value = true
    error.value = ''

    try {
      const redirectUri = import.meta.env.PROD
        ? `${window.location.origin}/settings/mydeposits?mydeposits_callback=true`
        : 'http://localhost:5173/settings/mydeposits?mydeposits_callback=true'

      const response = await fetch(`${API_URL}/api/settings/mydeposits/auth/callback`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          code,
          codeVerifier: storedVerifier,
          redirectUri
        })
      })

      const data = await response.json()

      if (response.ok) {
        success.value = 'mydeposits account linked successfully!'
        sessionStorage.removeItem('mydeposits_code_verifier')
        await fetchSettings()

        // Clear URL params
        window.history.replaceState({}, document.title, '/settings')
      } else {
        error.value = data.error || 'Failed to link account'
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to link account'
    } finally {
      linking.value = false
    }
  }
}

// Save credentials
const saveCredentials = async () => {
  saving.value = true
  error.value = ''
  success.value = ''

  try {
    const payload: any = {
      schemeType: form.value.schemeType,
      environment: form.value.environment
    }

    if (form.value.clientId) {
      payload.clientId = form.value.clientId
    }
    if (form.value.clientSecret) {
      payload.clientSecret = form.value.clientSecret
    }

    const response = await fetch(`${API_URL}/api/settings/mydeposits`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (response.ok) {
      success.value = 'Credentials saved. Click "Link Account" to complete setup.'
      form.value.clientSecret = ''
      await fetchSettings()
    } else {
      error.value = data.error || 'Failed to save credentials'
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to save credentials'
  } finally {
    saving.value = false
  }
}

// Link account (start OAuth)
const linkAccount = async () => {
  linking.value = true
  error.value = ''

  try {
    const redirectUri = `${window.location.origin}/settings/mydeposits?mydeposits_callback=true`

    const response = await fetch(
      `${API_URL}/api/settings/mydeposits/auth/start?redirect_uri=${encodeURIComponent(redirectUri)}`,
      { headers: getHeaders() }
    )

    if (response.ok) {
      const data = await response.json()
      // Store code verifier for PKCE
      sessionStorage.setItem('mydeposits_code_verifier', data.codeVerifier)
      // Open mydeposits auth in new tab
      window.open(data.authUrl, '_blank')
      linking.value = false
    } else {
      const data = await response.json()
      error.value = data.error || 'Failed to start authorization'
      linking.value = false
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to start authorization'
    linking.value = false
  }
}

// Test connection
const testConnection = async () => {
  testing.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await fetch(`${API_URL}/api/settings/mydeposits/test`, {
      method: 'POST',
      headers: getHeaders()
    })

    const data = await response.json()

    if (response.ok && data.success) {
      success.value = data.message || 'Connection successful!'
      await fetchSettings()
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
  if (!confirm('Are you sure you want to remove the mydeposits integration?')) return

  removing.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_URL}/api/settings/mydeposits`, {
      method: 'DELETE',
      headers: getHeaders()
    })

    if (response.ok) {
      status.value = null
      form.value = {
        clientId: '',
        clientSecret: '',
        schemeType: 'custodial',
        environment: 'sandbox'
      }
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
  handleOAuthCallback()
})
</script>

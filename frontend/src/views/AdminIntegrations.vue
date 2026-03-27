<template>
  <div class="min-h-screen bg-background">
    <AdminHeader />

    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="flex items-center gap-3 mb-8">
        <img src="/reposit-logo.png" alt="Reposit" class="h-7 w-auto" />
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Reposit Integration Manager</h1>
      </div>

      <!-- Company Search -->
      <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6 mb-6">
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Search Company</label>
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="searchQuery"
            @input="debouncedSearch"
            type="text"
            placeholder="Type company name to search..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
          />
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="mt-3 border border-gray-200 dark:border-slate-700 rounded-md divide-y divide-gray-200 dark:divide-slate-700 max-h-60 overflow-y-auto">
          <button
            v-for="company in searchResults"
            :key="company.id"
            @click="selectCompany(company)"
            class="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
          >
            <div>
              <span class="font-medium text-gray-900 dark:text-white">{{ company.name }}</span>
              <span v-if="company.email" class="ml-2 text-sm text-gray-500 dark:text-slate-400">{{ company.email }}</span>
            </div>
            <ChevronRight class="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <p v-if="searchQuery.length >= 2 && searchResults.length === 0 && !searching" class="mt-3 text-sm text-gray-500 dark:text-slate-400">
          No companies found
        </p>
      </div>

      <!-- Selected Company Config -->
      <div v-if="selectedCompany" class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ selectedCompany.name }}</h2>
            <p class="text-sm text-gray-500 dark:text-slate-400 font-mono">{{ selectedCompany.id }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span
              v-if="companyConfig"
              class="px-2 py-1 rounded-full text-xs font-medium"
              :class="companyConfig.lastTestStatus === 'success'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                : companyConfig.configured
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'"
            >
              {{ companyConfig.lastTestStatus === 'success' ? 'Connected' : companyConfig.configured ? 'Needs Testing' : 'Not Configured' }}
            </span>
            <button @click="selectedCompany = null; companyConfig = null" class="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Loading Config -->
        <div v-if="loadingConfig" class="flex justify-center py-8">
          <Loader2 class="w-6 h-6 animate-spin text-primary" />
        </div>

        <!-- Config Form -->
        <form v-else @submit.prevent="saveConfig" class="space-y-4" data-form-type="other">
          <input type="text" name="trap-username" style="display:none" tabindex="-1" autocomplete="username" />
          <input type="password" name="trap-password" style="display:none" tabindex="-1" autocomplete="current-password" />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="admin-supplier-id" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Supplier ID *</label>
              <input
                id="admin-supplier-id"
                v-model="configForm.supplierId"
                type="text"
                required
                autocomplete="off"
                data-lpignore="true"
                data-1p-ignore
                class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                placeholder="org_xxxxx"
              />
              <p v-if="companyConfig?.supplierId" class="mt-1 text-xs text-gray-500">Current: {{ companyConfig.supplierId }}</p>
            </div>

            <div>
              <label for="admin-environment" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Environment</label>
              <select
                id="admin-environment"
                v-model="configForm.environment"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
              >
                <option value="live">Production</option>
                <option value="sandbox">Sandbox</option>
              </select>
            </div>
          </div>

          <div>
            <label for="admin-referrer-token" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Referrer Token</label>
            <div class="mt-1 relative">
              <input
                id="admin-referrer-token"
                v-model="configForm.referrerToken"
                :type="showReferrerToken ? 'text' : 'password'"
                autocomplete="off"
                data-lpignore="true"
                data-1p-ignore
                class="block w-full px-3 py-2 pr-20 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                :placeholder="companyConfig?.maskedReferrerToken || 'Enter Referrer Token'"
              />
              <button
                type="button"
                @click="showReferrerToken = !showReferrerToken"
                class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <Eye v-if="!showReferrerToken" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
            <p v-if="companyConfig?.maskedReferrerToken" class="mt-1 text-xs text-gray-500">Leave blank to keep existing</p>
          </div>

          <div>
            <label for="admin-api-key" class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
            <div class="mt-1 relative">
              <input
                id="admin-api-key"
                v-model="configForm.apiKey"
                :type="showApiKey ? 'text' : 'password'"
                autocomplete="off"
                data-lpignore="true"
                data-1p-ignore
                class="block w-full px-3 py-2 pr-20 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
                :placeholder="companyConfig?.maskedApiKey || 'Enter API Key (or agent can enter theirs)'"
              />
              <button
                type="button"
                @click="showApiKey = !showApiKey"
                class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <Eye v-if="!showApiKey" class="w-4 h-4" />
                <EyeOff v-else class="w-4 h-4" />
              </button>
            </div>
            <p class="mt-1 text-xs text-gray-500">Optional — the agent can enter this themselves from their Settings page</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-4 border-t dark:border-slate-700">
            <button
              type="submit"
              :disabled="saving || !configForm.supplierId"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              <Loader2 v-if="saving" class="w-4 h-4 animate-spin" />
              {{ saving ? 'Saving...' : 'Save Credentials' }}
            </button>
            <button
              v-if="companyConfig?.configured"
              type="button"
              @click="testConnection"
              :disabled="testingConnection"
              class="px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              <Loader2 v-if="testingConnection" class="w-4 h-4 animate-spin" />
              {{ testingConnection ? 'Testing...' : 'Test Connection' }}
            </button>
          </div>

          <!-- Messages -->
          <div v-if="configError" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
            {{ configError }}
          </div>
          <div v-if="configSuccess" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
            {{ configSuccess }}
          </div>

          <!-- Last tested -->
          <div v-if="companyConfig?.lastTestedAt" class="text-xs text-gray-500 dark:text-slate-400">
            Last tested: {{ formatDateTime(companyConfig.lastTestedAt) }}
            <span :class="companyConfig.lastTestStatus === 'success' ? 'text-green-600' : 'text-red-600'">
              ({{ companyConfig.lastTestStatus === 'success' ? 'Passed' : 'Failed' }})
            </span>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import AdminHeader from '../components/AdminHeader.vue'
import { Search, ChevronRight, X, Loader2, Eye, EyeOff } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const authStore = useAuthStore()

// State
const searchQuery = ref('')
const searchResults = ref<Array<{ id: string; name: string; email: string }>>([])
const searching = ref(false)
const selectedCompany = ref<{ id: string; name: string; email: string } | null>(null)
const loadingConfig = ref(false)
const companyConfig = ref<any>(null)

const configForm = ref({
  supplierId: '',
  referrerToken: '',
  apiKey: '',
  environment: 'live'
})

const showReferrerToken = ref(false)
const showApiKey = ref(false)
const saving = ref(false)
const testingConnection = ref(false)
const configError = ref('')
const configSuccess = ref('')

let searchTimeout: ReturnType<typeof setTimeout> | null = null

const buildHeaders = (contentType = false): Record<string, string> => {
  const headers: Record<string, string> = {}
  const token = authStore.session?.access_token
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (contentType) headers['Content-Type'] = 'application/json'
  return headers
}

const formatDateTime = (dateStr: string) => {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(dateStr))
}

const debouncedSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => searchCompanies(), 300)
}

const searchCompanies = async () => {
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }

  searching.value = true
  try {
    const response = await fetch(
      `${API_URL}/api/admin/companies/list?search=${encodeURIComponent(searchQuery.value)}&limit=20`,
      { headers: buildHeaders() }
    )
    if (response.ok) {
      const data = await response.json()
      searchResults.value = data.companies || []
    }
  } catch (err) {
    console.error('Search error:', err)
  } finally {
    searching.value = false
  }
}

const selectCompany = async (company: { id: string; name: string; email: string }) => {
  selectedCompany.value = company
  searchQuery.value = ''
  searchResults.value = []
  configError.value = ''
  configSuccess.value = ''
  await loadCompanyConfig(company.id)
}

const loadCompanyConfig = async (companyId: string) => {
  loadingConfig.value = true
  try {
    const response = await fetch(
      `${API_URL}/api/admin/reposit/${companyId}`,
      { headers: buildHeaders() }
    )
    if (response.ok) {
      companyConfig.value = await response.json()
      configForm.value.supplierId = companyConfig.value.supplierId || ''
      configForm.value.environment = companyConfig.value.environment || 'live'
      configForm.value.referrerToken = ''
      configForm.value.apiKey = ''
    }
  } catch (err) {
    console.error('Load config error:', err)
  } finally {
    loadingConfig.value = false
  }
}

const saveConfig = async () => {
  if (!selectedCompany.value) return

  saving.value = true
  configError.value = ''
  configSuccess.value = ''

  try {
    const payload: any = {
      supplierId: configForm.value.supplierId,
      environment: configForm.value.environment
    }
    if (configForm.value.referrerToken) payload.referrerToken = configForm.value.referrerToken
    if (configForm.value.apiKey) payload.apiKey = configForm.value.apiKey

    const response = await fetch(
      `${API_URL}/api/admin/reposit/${selectedCompany.value.id}`,
      {
        method: 'POST',
        headers: buildHeaders(true),
        body: JSON.stringify(payload)
      }
    )

    const data = await response.json()
    if (response.ok) {
      configSuccess.value = 'Credentials saved successfully'
      await loadCompanyConfig(selectedCompany.value.id)
    } else {
      configError.value = data.error || 'Failed to save'
    }
  } catch (err: any) {
    configError.value = err.message || 'Failed to save'
  } finally {
    saving.value = false
  }
}

const testConnection = async () => {
  if (!selectedCompany.value) return

  testingConnection.value = true
  configError.value = ''
  configSuccess.value = ''

  try {
    const response = await fetch(
      `${API_URL}/api/admin/reposit/${selectedCompany.value.id}/test`,
      {
        method: 'POST',
        headers: buildHeaders(true)
      }
    )

    const data = await response.json()
    if (response.ok && data.success) {
      configSuccess.value = 'Connection successful!'
      await loadCompanyConfig(selectedCompany.value.id)
    } else {
      configError.value = data.error || 'Connection test failed'
    }
  } catch (err: any) {
    configError.value = err.message || 'Connection test failed'
  } finally {
    testingConnection.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <AdminHeader />

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div class="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-600 dark:text-slate-400">Last 24 Hours</div>
                <div class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ stats.last24h }}</div>
              </div>
              <div class="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle class="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-600 dark:text-slate-400">Last 7 Days</div>
                <div class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ stats.last7d }}</div>
              </div>
              <div class="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle class="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-600 dark:text-slate-400">Last 30 Days</div>
                <div class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ stats.last30d }}</div>
              </div>
              <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle class="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-600 dark:text-slate-400">Unresolved</div>
                <div class="mt-2 text-3xl font-semibold" :class="stats.unresolved > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">{{ stats.unresolved }}</div>
              </div>
              <div class="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <CircleAlert class="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white dark:bg-slate-800 shadow rounded-lg p-4 mb-6">
        <div class="flex items-center gap-4 flex-wrap">
          <!-- Source filter -->
          <select
            v-model="filters.source"
            @change="fetchErrors()"
            class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            <option value="">All Sources</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
          </select>

          <!-- Level filter -->
          <select
            v-model="filters.level"
            @change="fetchErrors()"
            class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            <option value="">All Levels</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="fatal">Fatal</option>
          </select>

          <!-- Resolved filter -->
          <select
            v-model="filters.resolved"
            @change="fetchErrors()"
            class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            <option value="false">Unresolved</option>
            <option value="">All</option>
            <option value="true">Resolved</option>
          </select>

          <!-- Date range -->
          <div class="flex gap-2">
            <button
              v-for="range in dateRanges"
              :key="range.value"
              @click="setDateRange(range.value)"
              :class="filters.dateRange === range.value ? 'bg-primary text-white' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600'"
              class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium transition-colors"
            >
              {{ range.label }}
            </button>
          </div>

          <!-- Search -->
          <div class="flex-1 min-w-[200px]">
            <input
              v-model="filters.search"
              @keyup.enter="fetchErrors()"
              placeholder="Search error messages..."
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
            />
          </div>

          <button
            @click="fetchErrors()"
            class="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>

      <!-- Error List -->
      <div v-else>
        <!-- Top Errors (grouped by fingerprint) -->
        <div v-if="topErrors.length > 0 && !filters.search && filters.dateRange === '7d'" class="bg-white dark:bg-slate-800 shadow rounded-lg mb-6">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Top Errors (Last 7 Days)</h2>
          </div>
          <div class="divide-y divide-gray-200 dark:divide-slate-700">
            <div
              v-for="err in topErrors"
              :key="err.fingerprint"
              class="px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
              @click="filterByFingerprint(err.fingerprint)"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span :class="sourceBadgeClass(err.source)" class="px-2 py-0.5 text-xs font-medium rounded-full">{{ err.source }}</span>
                    <span :class="levelBadgeClass(err.level)" class="px-2 py-0.5 text-xs font-medium rounded-full">{{ err.level }}</span>
                    <span v-if="err.error_type" class="text-xs text-gray-500 dark:text-slate-400">{{ err.error_type }}</span>
                  </div>
                  <p class="text-sm text-gray-900 dark:text-white truncate">{{ err.message }}</p>
                </div>
                <div class="ml-4 flex-shrink-0 text-right">
                  <div class="text-2xl font-bold text-red-600 dark:text-red-400">{{ err.count }}</div>
                  <div class="text-xs text-gray-500 dark:text-slate-400">occurrences</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Error Table -->
        <div class="bg-white dark:bg-slate-800 shadow rounded-lg">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              Error Logs
              <span class="text-sm font-normal text-gray-500 dark:text-slate-400">({{ pagination.total }} total)</span>
            </h2>
            <div v-if="filters.fingerprint" class="flex items-center gap-2">
              <span class="text-sm text-gray-500 dark:text-slate-400">Filtered by fingerprint</span>
              <button
                @click="clearFingerprint()"
                class="px-2 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div v-if="errors.length === 0" class="p-12 text-center text-gray-500 dark:text-slate-400">
            No errors found matching your filters.
          </div>

          <div v-else class="divide-y divide-gray-200 dark:divide-slate-700">
            <div
              v-for="err in errors"
              :key="err.id"
              class="group"
            >
              <!-- Error Row -->
              <div
                class="px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                @click="toggleExpand(err.id)"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span :class="sourceBadgeClass(err.source)" class="px-2 py-0.5 text-xs font-medium rounded-full">{{ err.source }}</span>
                      <span :class="levelBadgeClass(err.level)" class="px-2 py-0.5 text-xs font-medium rounded-full">{{ err.level }}</span>
                      <span v-if="err.error_type" class="text-xs text-gray-500 dark:text-slate-400 font-mono">{{ err.error_type }}</span>
                      <span v-if="err.resolved_at" class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">Resolved</span>
                    </div>
                    <p class="text-sm text-gray-900 dark:text-white font-medium truncate">{{ err.message }}</p>
                    <div class="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-slate-400">
                      <span>{{ formatTime(err.created_at) }}</span>
                      <span v-if="err.route_path">{{ err.route_name || err.route_path }}</span>
                      <span v-if="err.request_method && err.request_url">{{ err.request_method }} {{ err.request_url }}</span>
                      <span v-if="err.user_email">{{ err.user_email }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <button
                      v-if="!err.resolved_at"
                      @click.stop="resolveError(err.id)"
                      class="px-3 py-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                    >
                      Resolve
                    </button>
                    <ChevronDown
                      class="w-5 h-5 text-gray-400 transition-transform"
                      :class="{ 'rotate-180': expandedIds.has(err.id) }"
                    />
                  </div>
                </div>
              </div>

              <!-- Expanded Details -->
              <div v-if="expandedIds.has(err.id)" class="px-6 pb-4 bg-gray-50 dark:bg-slate-700/30">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <!-- Stack Trace -->
                  <div v-if="err.stack_trace" class="lg:col-span-2">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Stack Trace</span>
                      <button
                        @click="copyToClipboard(err.stack_trace)"
                        class="text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <pre class="text-xs bg-gray-900 text-green-400 p-3 rounded-md overflow-x-auto max-h-64">{{ err.stack_trace }}</pre>
                  </div>

                  <!-- Route Info (Frontend) -->
                  <div v-if="err.route_path || err.component_name">
                    <span class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Page / Component</span>
                    <div class="mt-1 text-sm text-gray-900 dark:text-white">
                      <div v-if="err.route_name"><span class="text-gray-500 dark:text-slate-400">Route:</span> {{ err.route_name }}</div>
                      <div v-if="err.route_path"><span class="text-gray-500 dark:text-slate-400">Path:</span> {{ err.route_path }}</div>
                      <div v-if="err.component_name"><span class="text-gray-500 dark:text-slate-400">Component:</span> {{ err.component_name }}</div>
                      <div v-if="err.route_params"><span class="text-gray-500 dark:text-slate-400">Params:</span> {{ JSON.stringify(err.route_params) }}</div>
                    </div>
                  </div>

                  <!-- Request Info (Backend) -->
                  <div v-if="err.request_method">
                    <span class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Request</span>
                    <div class="mt-1 text-sm text-gray-900 dark:text-white">
                      <div><span class="text-gray-500 dark:text-slate-400">Method:</span> {{ err.request_method }}</div>
                      <div><span class="text-gray-500 dark:text-slate-400">URL:</span> {{ err.request_url }}</div>
                      <div v-if="err.response_status_code"><span class="text-gray-500 dark:text-slate-400">Status:</span> {{ err.response_status_code }}</div>
                      <div v-if="err.request_query"><span class="text-gray-500 dark:text-slate-400">Query:</span> {{ JSON.stringify(err.request_query) }}</div>
                      <div v-if="err.request_body"><span class="text-gray-500 dark:text-slate-400">Body:</span> <pre class="text-xs mt-1 bg-gray-100 dark:bg-slate-800 p-2 rounded overflow-x-auto">{{ JSON.stringify(err.request_body, null, 2) }}</pre></div>
                    </div>
                  </div>

                  <!-- User Info -->
                  <div v-if="err.user_email || err.user_id">
                    <span class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">User</span>
                    <div class="mt-1 text-sm text-gray-900 dark:text-white">
                      <div v-if="err.user_email"><span class="text-gray-500 dark:text-slate-400">Email:</span> {{ err.user_email }}</div>
                      <div v-if="err.user_id"><span class="text-gray-500 dark:text-slate-400">ID:</span> <span class="font-mono text-xs">{{ err.user_id }}</span></div>
                      <div v-if="err.company_id"><span class="text-gray-500 dark:text-slate-400">Company:</span> <span class="font-mono text-xs">{{ err.company_id }}</span></div>
                      <div v-if="err.branch_id"><span class="text-gray-500 dark:text-slate-400">Branch:</span> <span class="font-mono text-xs">{{ err.branch_id }}</span></div>
                    </div>
                  </div>

                  <!-- Browser Info -->
                  <div v-if="err.browser_info">
                    <span class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Browser</span>
                    <div class="mt-1 text-sm text-gray-900 dark:text-white">
                      <div v-if="err.browser_info.userAgent" class="truncate"><span class="text-gray-500 dark:text-slate-400">UA:</span> {{ err.browser_info.userAgent }}</div>
                      <div><span class="text-gray-500 dark:text-slate-400">Screen:</span> {{ err.browser_info.screenWidth }}x{{ err.browser_info.screenHeight }}</div>
                      <div><span class="text-gray-500 dark:text-slate-400">Viewport:</span> {{ err.browser_info.viewportWidth }}x{{ err.browser_info.viewportHeight }}</div>
                    </div>
                  </div>

                  <!-- IP / User Agent (Backend) -->
                  <div v-if="err.ip_address && !err.browser_info">
                    <span class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Network</span>
                    <div class="mt-1 text-sm text-gray-900 dark:text-white">
                      <div><span class="text-gray-500 dark:text-slate-400">IP:</span> {{ err.ip_address }}</div>
                      <div v-if="err.user_agent" class="truncate"><span class="text-gray-500 dark:text-slate-400">UA:</span> {{ err.user_agent }}</div>
                    </div>
                  </div>

                  <!-- Metadata -->
                  <div v-if="err.metadata && Object.keys(err.metadata).length > 0">
                    <span class="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">Metadata</span>
                    <pre class="mt-1 text-xs bg-gray-100 dark:bg-slate-800 p-2 rounded overflow-x-auto">{{ JSON.stringify(err.metadata, null, 2) }}</pre>
                  </div>

                  <!-- Fingerprint / Resolve Actions -->
                  <div class="lg:col-span-2 flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-600">
                    <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
                      <span>Fingerprint: <span class="font-mono">{{ err.fingerprint?.substring(0, 12) }}...</span></span>
                      <button
                        @click="filterByFingerprint(err.fingerprint)"
                        class="text-primary hover:text-primary/80 transition-colors"
                      >
                        View all with this fingerprint
                      </button>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        @click="copyErrorDetails(err)"
                        class="px-3 py-1 text-xs bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors"
                      >
                        Copy All
                      </button>
                      <button
                        v-if="!err.resolved_at"
                        @click="resolveByFingerprint(err.fingerprint)"
                        class="px-3 py-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                      >
                        Resolve All Like This
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="pagination.totalPages > 1" class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div class="text-sm text-gray-500 dark:text-slate-400">
              Page {{ pagination.page }} of {{ pagination.totalPages }}
            </div>
            <div class="flex gap-2">
              <button
                @click="goToPage(pagination.page - 1)"
                :disabled="pagination.page <= 1"
                class="px-3 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors"
              >
                Previous
              </button>
              <button
                @click="goToPage(pagination.page + 1)"
                :disabled="pagination.page >= pagination.totalPages"
                class="px-3 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import AdminHeader from '../components/AdminHeader.vue'
import { AlertTriangle, CircleAlert, ChevronDown } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const authStore = useAuthStore()

interface ErrorLog {
  id: string
  source: string
  level: string
  message: string
  stack_trace: string | null
  error_type: string | null
  error_code: string | null
  user_id: string | null
  user_email: string | null
  company_id: string | null
  branch_id: string | null
  route_name: string | null
  route_path: string | null
  route_params: Record<string, any> | null
  component_name: string | null
  app_version: string | null
  browser_info: Record<string, any> | null
  request_method: string | null
  request_url: string | null
  request_query: Record<string, any> | null
  request_body: Record<string, any> | null
  response_status_code: number | null
  ip_address: string | null
  user_agent: string | null
  fingerprint: string | null
  metadata: Record<string, any> | null
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

interface TopError {
  fingerprint: string
  message: string
  source: string
  level: string
  error_type: string | null
  count: number
  latest: string
}

const loading = ref(true)
const errors = ref<ErrorLog[]>([])
const topErrors = ref<TopError[]>([])
const expandedIds = ref<Set<string>>(new Set())
const stats = reactive({ last24h: 0, last7d: 0, last30d: 0, unresolved: 0 })
const pagination = reactive({ page: 1, limit: 50, total: 0, totalPages: 0 })

const filters = reactive({
  source: '',
  level: '',
  resolved: 'false',
  dateRange: '7d',
  search: '',
  fingerprint: '',
})

const dateRanges = [
  { label: 'Today', value: '1d' },
  { label: '7 Days', value: '7d' },
  { label: '30 Days', value: '30d' },
]

function getAuthHeaders() {
  return { Authorization: `Bearer ${authStore.session?.access_token}` }
}

function getDateRange() {
  const now = new Date()
  if (filters.dateRange === '1d') return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  if (filters.dateRange === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (filters.dateRange === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  return undefined
}

async function fetchStats() {
  try {
    const { data } = await axios.get(`${API_URL}/api/error-logs/stats`, { headers: getAuthHeaders() })
    stats.last24h = data.totals?.last24h || 0
    stats.last7d = data.totals?.last7d || 0
    stats.last30d = data.totals?.last30d || 0
    stats.unresolved = data.totals?.unresolved || 0
    topErrors.value = data.topErrors || []
  } catch (err) {
    console.error('Failed to fetch error stats:', err)
  }
}

async function fetchErrors() {
  loading.value = true
  try {
    const params: Record<string, string> = {
      page: String(pagination.page),
      limit: String(pagination.limit),
    }
    if (filters.source) params.source = filters.source
    if (filters.level) params.level = filters.level
    if (filters.resolved) params.resolved = filters.resolved
    if (filters.search) params.search = filters.search
    if (filters.fingerprint) params.fingerprint = filters.fingerprint

    const startDate = getDateRange()
    if (startDate) params.start_date = startDate

    const { data } = await axios.get(`${API_URL}/api/error-logs`, {
      headers: getAuthHeaders(),
      params,
    })
    errors.value = data.data || []
    pagination.total = data.pagination?.total || 0
    pagination.totalPages = data.pagination?.totalPages || 0
  } catch (err) {
    console.error('Failed to fetch errors:', err)
  } finally {
    loading.value = false
  }
}

function setDateRange(range: string) {
  filters.dateRange = range
  pagination.page = 1
  fetchErrors()
}

function filterByFingerprint(fingerprint: string) {
  filters.fingerprint = fingerprint
  pagination.page = 1
  fetchErrors()
}

function clearFingerprint() {
  filters.fingerprint = ''
  pagination.page = 1
  fetchErrors()
}

function goToPage(page: number) {
  if (page < 1 || page > pagination.totalPages) return
  pagination.page = page
  fetchErrors()
}

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

async function resolveError(id: string) {
  try {
    await axios.patch(`${API_URL}/api/error-logs/${id}/resolve`, {}, { headers: getAuthHeaders() })
    const err = errors.value.find(e => e.id === id)
    if (err) err.resolved_at = new Date().toISOString()
    stats.unresolved = Math.max(0, stats.unresolved - 1)
  } catch (err) {
    console.error('Failed to resolve error:', err)
  }
}

async function resolveByFingerprint(fingerprint: string) {
  try {
    await axios.patch(`${API_URL}/api/error-logs/resolve-by-fingerprint`, { fingerprint }, { headers: getAuthHeaders() })
    errors.value.forEach(e => {
      if (e.fingerprint === fingerprint) e.resolved_at = new Date().toISOString()
    })
    fetchStats()
  } catch (err) {
    console.error('Failed to resolve errors:', err)
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

function copyErrorDetails(err: ErrorLog) {
  const lines: string[] = [
    `Error: ${err.message}`,
    `Source: ${err.source} | Level: ${err.level} | Type: ${err.error_type || 'N/A'}`,
    `Time: ${new Date(err.created_at).toLocaleString()}`,
  ]

  if (err.route_name || err.route_path) {
    lines.push(`Route: ${err.route_name || ''} (${err.route_path || ''})`)
  }
  if (err.route_params) lines.push(`Params: ${JSON.stringify(err.route_params)}`)
  if (err.component_name) lines.push(`Component: ${err.component_name}`)

  if (err.request_method) {
    lines.push(`Request: ${err.request_method} ${err.request_url}`)
    if (err.response_status_code) lines.push(`Status: ${err.response_status_code}`)
    if (err.request_query) lines.push(`Query: ${JSON.stringify(err.request_query)}`)
    if (err.request_body) lines.push(`Body: ${JSON.stringify(err.request_body, null, 2)}`)
  }

  if (err.user_email) lines.push(`User: ${err.user_email} (${err.user_id || 'N/A'})`)
  if (err.company_id) lines.push(`Company: ${err.company_id}`)
  if (err.branch_id) lines.push(`Branch: ${err.branch_id}`)
  if (err.ip_address) lines.push(`IP: ${err.ip_address}`)

  if (err.browser_info) {
    lines.push(`Browser: ${err.browser_info.userAgent || 'N/A'}`)
    lines.push(`Screen: ${err.browser_info.screenWidth}x${err.browser_info.screenHeight} | Viewport: ${err.browser_info.viewportWidth}x${err.browser_info.viewportHeight}`)
  } else if (err.user_agent) {
    lines.push(`UA: ${err.user_agent}`)
  }

  if (err.stack_trace) lines.push(`\nStack Trace:\n${err.stack_trace}`)
  if (err.metadata && Object.keys(err.metadata).length > 0) lines.push(`\nMetadata: ${JSON.stringify(err.metadata, null, 2)}`)

  lines.push(`\nFingerprint: ${err.fingerprint}`)

  navigator.clipboard.writeText(lines.join('\n'))
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function sourceBadgeClass(source: string) {
  return source === 'frontend'
    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
}

function levelBadgeClass(level: string) {
  if (level === 'fatal') return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
  if (level === 'warn') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
  return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'
}

onMounted(() => {
  fetchStats()
  fetchErrors()
})
</script>

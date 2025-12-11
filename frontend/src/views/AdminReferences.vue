<template>
  <div class="min-h-screen bg-gray-100">
    <AdminHeader />

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900">All References</h1>
        <p class="mt-1 text-sm text-gray-500">Search and view all tenant references across all companies</p>
      </div>

      <!-- Search and Filters -->
      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="flex flex-col md:flex-row gap-4">
          <!-- Search Input -->
          <div class="flex-1">
            <label for="search" class="sr-only">Search</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                id="search"
                v-model="searchQuery"
                type="text"
                placeholder="Search by tenant name, guarantor, property, company, or email..."
                class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
              />
            </div>
          </div>

          <!-- Status Filter -->
          <div class="w-full md:w-48">
            <label for="status" class="sr-only">Status</label>
            <select
              id="status"
              v-model="statusFilter"
              class="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm rounded-md"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Results Count -->
      <div class="mb-4 text-sm text-gray-500">
        <span v-if="loading">Loading...</span>
        <span v-else>{{ total }} reference{{ total === 1 ? '' : 's' }} found</span>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {{ error }}
      </div>

      <!-- Results Table -->
      <div v-else class="bg-white shadow rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tenant
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Property
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Guarantor
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Move-in
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Submitted
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <template v-for="reference in references" :key="reference.id">
              <!-- Main Row -->
              <tr
                @click="toggleRow(reference.id)"
                class="hover:bg-gray-50 cursor-pointer transition-colors"
                :class="{ 'bg-gray-50': expandedRows.has(reference.id) }"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <svg
                      class="h-4 w-4 mr-2 text-gray-400 transition-transform"
                      :class="{ 'rotate-90': expandedRows.has(reference.id) }"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <div>
                      <div class="text-sm font-medium text-gray-900">{{ reference.tenant_name }}</div>
                      <div class="text-sm text-gray-500">{{ reference.tenant_email }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900 max-w-xs truncate">{{ reference.property_address }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getStatusClass(reference.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                    {{ formatStatus(reference.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{{ reference.company_name }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div v-if="reference.guarantor" class="text-sm text-gray-900">{{ reference.guarantor.name }}</div>
                  <div v-else-if="reference.requires_guarantor" class="text-sm text-yellow-600">Required</div>
                  <div v-else class="text-sm text-gray-400">-</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ reference.move_in_date ? formatDate(reference.move_in_date) : '-' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(reference.created_at) }}
                </td>
              </tr>

              <!-- Expanded Details Row -->
              <tr v-if="expandedRows.has(reference.id)">
                <td colspan="7" class="px-6 py-4 bg-gray-50">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Contact Details -->
                    <div>
                      <h4 class="text-sm font-medium text-gray-900 mb-2">Contact Details</h4>
                      <dl class="space-y-1">
                        <div>
                          <dt class="text-xs text-gray-500">Email</dt>
                          <dd class="text-sm text-gray-900">{{ reference.tenant_email || '-' }}</dd>
                        </div>
                        <div>
                          <dt class="text-xs text-gray-500">Phone</dt>
                          <dd class="text-sm text-gray-900">{{ reference.tenant_phone || '-' }}</dd>
                        </div>
                      </dl>
                    </div>

                    <!-- Property Details -->
                    <div>
                      <h4 class="text-sm font-medium text-gray-900 mb-2">Property Details</h4>
                      <dl class="space-y-1">
                        <div>
                          <dt class="text-xs text-gray-500">Full Address</dt>
                          <dd class="text-sm text-gray-900">{{ reference.property_address || '-' }}</dd>
                        </div>
                        <div>
                          <dt class="text-xs text-gray-500">Move-in Date</dt>
                          <dd class="text-sm text-gray-900">{{ reference.move_in_date ? formatDate(reference.move_in_date) : '-' }}</dd>
                        </div>
                      </dl>
                    </div>

                    <!-- Guarantor Details -->
                    <div>
                      <h4 class="text-sm font-medium text-gray-900 mb-2">Guarantor Details</h4>
                      <dl v-if="reference.guarantor" class="space-y-1">
                        <div>
                          <dt class="text-xs text-gray-500">Name</dt>
                          <dd class="text-sm text-gray-900">{{ reference.guarantor.name }}</dd>
                        </div>
                        <div>
                          <dt class="text-xs text-gray-500">Status</dt>
                          <dd>
                            <span :class="getStatusClass(reference.guarantor.status)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                              {{ formatStatus(reference.guarantor.status) }}
                            </span>
                          </dd>
                        </div>
                        <div v-if="reference.guarantor.tas_category">
                          <dt class="text-xs text-gray-500">Outcome</dt>
                          <dd>
                            <span :class="getOutcomeClass(reference.guarantor.tas_category)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                              {{ formatOutcome(reference.guarantor.tas_category) }}
                            </span>
                          </dd>
                        </div>
                      </dl>
                      <p v-else-if="reference.requires_guarantor" class="text-sm text-yellow-600">Guarantor required but not yet assigned</p>
                      <p v-else class="text-sm text-gray-400">No guarantor required</p>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="mt-4 pt-4 border-t border-gray-200">
                    <router-link
                      :to="`/staff/references/${reference.id}`"
                      class="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      <svg class="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View in Staff Portal
                    </router-link>
                  </div>
                </td>
              </tr>
            </template>

            <!-- Empty State -->
            <tr v-if="references.length === 0 && !loading">
              <td colspan="8" class="px-6 py-12 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">No references found</h3>
                <p class="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="total > limit && !loading" class="mt-4 flex items-center justify-between">
        <div class="text-sm text-gray-700">
          Showing {{ offset + 1 }} to {{ Math.min(offset + limit, total) }} of {{ total }} results
        </div>
        <div class="flex gap-2">
          <button
            @click="prevPage"
            :disabled="offset === 0"
            class="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            @click="nextPage"
            :disabled="offset + limit >= total"
            class="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import axios from 'axios'
import AdminHeader from '../components/AdminHeader.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// State
const references = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const statusFilter = ref('all')
const total = ref(0)
const limit = ref(50)
const offset = ref(0)
const expandedRows = ref<Set<string>>(new Set())

// Debounce timer
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Fetch references
const fetchReferences = async () => {
  loading.value = true
  error.value = null

  try {
    const params = new URLSearchParams()
    if (searchQuery.value) params.append('query', searchQuery.value)
    if (statusFilter.value !== 'all') params.append('status', statusFilter.value)
    params.append('limit', limit.value.toString())
    params.append('offset', offset.value.toString())

    const response = await axios.get(`${API_URL}/api/admin/references/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${authStore.session?.access_token}`
      }
    })

    references.value = response.data.references
    total.value = response.data.total
  } catch (err: any) {
    console.error('Error fetching references:', err)
    error.value = err.response?.data?.error || 'Failed to fetch references'
  } finally {
    loading.value = false
  }
}

// Toggle row expansion
const toggleRow = (id: string) => {
  if (expandedRows.value.has(id)) {
    expandedRows.value.delete(id)
  } else {
    expandedRows.value.add(id)
  }
  expandedRows.value = new Set(expandedRows.value) // Trigger reactivity
}

// Pagination
const prevPage = () => {
  offset.value = Math.max(0, offset.value - limit.value)
  fetchReferences()
}

const nextPage = () => {
  offset.value = offset.value + limit.value
  fetchReferences()
}

// Format functions
const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const formatStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    pending_verification: 'Pending Verification',
    completed: 'Completed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    awaiting_guarantor: 'Awaiting Guarantor'
  }
  return statusMap[status] || status
}

const getStatusClass = (status: string) => {
  const classMap: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    pending_verification: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    awaiting_guarantor: 'bg-purple-100 text-purple-800'
  }
  return classMap[status] || 'bg-gray-100 text-gray-800'
}

const formatOutcome = (tasCategory: string) => {
  const outcomeMap: Record<string, string> = {
    PASS: 'Pass',
    PASS_WITH_CONDITIONS: 'Pass w/ Conditions',
    PASS_WITH_GUARANTOR: 'Pass w/ Guarantor',
    FAIL: 'Fail',
    REFER: 'Refer'
  }
  return outcomeMap[tasCategory] || tasCategory
}

const getOutcomeClass = (tasCategory: string) => {
  const classMap: Record<string, string> = {
    PASS: 'bg-green-100 text-green-800',
    PASS_WITH_CONDITIONS: 'bg-yellow-100 text-yellow-800',
    PASS_WITH_GUARANTOR: 'bg-purple-100 text-purple-800',
    FAIL: 'bg-red-100 text-red-800',
    REFER: 'bg-orange-100 text-orange-800'
  }
  return classMap[tasCategory] || 'bg-gray-100 text-gray-800'
}

// Watch for search/filter changes
watch([searchQuery, statusFilter], () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    offset.value = 0 // Reset to first page on new search
    fetchReferences()
  }, 300)
})

// Initial fetch
onMounted(() => {
  fetchReferences()
})
</script>

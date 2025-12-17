<template>
  <div class="min-h-screen bg-gray-100">
    <AdminHeader />

    <div class="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
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
      <div v-else class="bg-white shadow rounded-lg overflow-x-auto">
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
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{{ reference.property_address }}</div>
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
                  <div class="mt-4 pt-4 border-t border-gray-200 flex items-center gap-3">
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
                    <button
                      @click.stop="confirmDelete(reference)"
                      class="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <svg class="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
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

    <!-- Delete Confirmation Modal -->
    <div v-if="deleteModal.show" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" @click="deleteModal.show = false"></div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
        <div class="inline-block overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="px-4 pt-5 pb-4 bg-white sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="flex items-center justify-center flex-shrink-0 w-12 h-12 mx-auto bg-red-100 rounded-full sm:mx-0 sm:h-10 sm:w-10">
                <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 class="text-lg font-medium leading-6 text-gray-900">Delete Reference</h3>
                <div class="mt-2">
                  <p class="text-sm text-gray-500">
                    Are you sure you want to delete the reference for <strong>{{ deleteModal.reference?.tenant_name }}</strong>?
                    This will permanently delete all related data including verification results, work items, and any guarantor references.
                  </p>
                  <p class="mt-2 text-sm font-medium text-red-600">This action cannot be undone.</p>
                </div>
              </div>
            </div>
          </div>
          <div class="px-4 py-3 bg-gray-50 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
            <button
              @click="executeDelete"
              :disabled="deleteModal.loading"
              class="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              <svg v-if="deleteModal.loading" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ deleteModal.loading ? 'Deleting...' : 'Delete' }}
            </button>
            <button
              @click="deleteModal.show = false"
              :disabled="deleteModal.loading"
              class="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
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
const deleteModal = ref<{
  show: boolean
  loading: boolean
  reference: any | null
}>({
  show: false,
  loading: false,
  reference: null
})

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

// Delete functions
const confirmDelete = (reference: any) => {
  deleteModal.value = {
    show: true,
    loading: false,
    reference
  }
}

const executeDelete = async () => {
  if (!deleteModal.value.reference) return

  deleteModal.value.loading = true

  try {
    await axios.delete(`${API_URL}/api/admin/references/${deleteModal.value.reference.id}`, {
      headers: {
        Authorization: `Bearer ${authStore.session?.access_token}`
      }
    })

    // Remove from local list
    references.value = references.value.filter(r => r.id !== deleteModal.value.reference?.id)
    total.value--

    // Close modal
    deleteModal.value = { show: false, loading: false, reference: null }
  } catch (err: any) {
    console.error('Error deleting reference:', err)
    alert(err.response?.data?.error || 'Failed to delete reference')
    deleteModal.value.loading = false
  }
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

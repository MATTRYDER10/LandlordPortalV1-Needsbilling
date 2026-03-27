<template>
  <Sidebar>
    <div class="p-8 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
      <div class="mb-8">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Landlords</h2>
            <p class="mt-2 text-gray-600 dark:text-slate-400">Manage all landlord details and AML checks</p>
          </div>
          <div class="flex gap-3">
            <button
              @click="showImportModal = true"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Import CSV
            </button>
            <button
              @click="showAddModal = true"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
            >
              Add Landlord
            </button>
          </div>
        </div>

        <!-- Search and Filters -->
        <div class="flex gap-3 mb-6">
          <!-- Search Box -->
          <div class="relative flex-1">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search landlords..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 rounded-md leading-5 bg-white dark:bg-slate-800 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search class="h-5 w-5 text-gray-400 dark:text-slate-500" />
            </div>
          </div>

          <!-- AML Status Filter -->
          <select
            v-model="amlStatusFilter"
            class="block pl-3 pr-10 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
          >
            <option value="">All AML Status</option>
            <option value="not_requested">Not Requested</option>
            <option value="requested">Requested</option>
            <option value="satisfactory">AML Satisfactory</option>
            <option value="unsatisfactory">AML Unsatisfactory</option>
          </select>
        </div>

        <div
          v-if="outdatedAmlLandlords.length > 0"
          class="mb-6 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-4 py-3"
        >
          <p class="text-sm font-medium text-amber-900 dark:text-amber-200">
            {{ outdatedAmlLandlords.length }} landlord{{ outdatedAmlLandlords.length === 1 ? '' : 's' }} have AML checks older than 2 years. Please re-check.
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="landlord in outdatedAmlLandlords"
              :key="landlord.id"
              @click="goToAmlRecheck(landlord.id)"
              class="text-sm font-medium text-amber-900 dark:text-amber-300 underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-200"
            >
              Re-check AML for {{ landlord.first_name }} {{ landlord.last_name }}
            </button>
          </div>
        </div>

        <!-- Bulk Actions Bar -->
        <div
          v-if="selectedLandlords.size > 0"
          class="mb-4 p-3 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-lg flex items-center justify-between"
        >
          <span class="text-sm font-medium text-gray-700 dark:text-slate-300">
            {{ selectedLandlords.size }} landlord{{ selectedLandlords.size === 1 ? '' : 's' }} selected
          </span>
          <div class="flex gap-2">
            <button
              @click="clearSelection"
              class="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
            >
              Clear selection
            </button>
            <button
              @click="bulkDeleteLandlords"
              :disabled="bulkDeleting"
              class="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
            >
              {{ bulkDeleting ? 'Deleting...' : 'Delete Selected' }}
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          <div class="p-8 text-center text-gray-600 dark:text-slate-400">Loading landlords...</div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg">
          {{ error }}
        </div>

        <!-- Landlords Table -->
        <div v-else class="bg-white dark:bg-slate-800 rounded-lg shadow overflow-visible">
          <div class="overflow-x-autol">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead class="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th scope="col" class="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    :checked="landlords.length > 0 && selectedLandlords.size === landlords.length"
                    :indeterminate="selectedLandlords.size > 0 && selectedLandlords.size < landlords.length"
                    @change="toggleSelectAll"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded"
                  />
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Landlords
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  AML Status
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Date AML Completed
                </th>
                <th scope="col" class="relative px-6 py-3">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              <tr v-if="landlords.length === 0">
                <td colspan="5" class="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                  No landlords found
                </td>
              </tr>
              <tr
                v-for="landlord in landlords"
                :key="landlord.id"
                class="hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                :class="{ 'bg-primary/5 dark:bg-primary/10': selectedLandlords.has(landlord.id) }"
                @click="viewLandlord(landlord.id)"
              >
                <td class="px-6 py-4 whitespace-nowrap" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedLandlords.has(landlord.id)"
                    @change="toggleSelectLandlord(landlord.id)"
                    class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div>
                      <div class="text-sm font-medium text-gray-900 dark:text-white">
                        {{ landlord.company_name || `${landlord.first_name} ${landlord.last_name}` }}
                      </div>
                      <div v-if="landlord.company_name" class="text-xs text-gray-400 dark:text-slate-500">
                        {{ landlord.first_name }} {{ landlord.last_name }}
                      </div>
                      <div class="text-sm text-gray-500 dark:text-slate-400">{{ landlord.email }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="{
                      'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300': landlord.aml_status === 'satisfactory' || landlord.aml_status === 'passed',
                      'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300': landlord.aml_status === 'unsatisfactory' || landlord.aml_status === 'failed',
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300': landlord.aml_status === 'requested' || landlord.aml_status === 'pending' || landlord.aml_status === 'submitted',
                      'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300': landlord.aml_status === 'not_requested'
                    }"
                  >
                    {{ formatAMLStatus(landlord.aml_status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                  {{ landlord.aml_completed_at ? formatDate(landlord.aml_completed_at) : 'n/a' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      @click.stop="viewLandlord(landlord.id)"
                      class="text-primary hover:text-primary/80"
                    >
                      View
                    </button>
                    <div class="relative actions-menu-container" style="z-index: 50;">
                      <button
                        @click.stop="toggleActionsMenu(landlord.id)"
                        class="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300"
                      >
                        <MoreVertical class="w-5 h-5" />
                      </button>
                      <div
                        v-if="actionsMenuOpen === landlord.id"
                        class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 dark:ring-slate-700"
                        style="z-index: 9999;"
                      >
                        <div class="py-1">
                          <button
                            @click.stop="editLandlord(landlord.id)"
                            class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            Edit
                          </button>
                          <button
                            v-if="landlord.aml_status === 'not_requested' || landlord.aml_status === 'requested'"
                            @click.stop="requestIdVerification(landlord.id)"
                            class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            Request ID Verification
                          </button>
                          <button
                            @click.stop="deleteLandlord(landlord.id)"
                            class="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          <!-- Load More / Pagination Info -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-slate-400">
              Showing {{ landlords.length }} of {{ totalCount }} landlord{{ totalCount === 1 ? '' : 's' }}
            </span>
            <button
              v-if="hasMorePages"
              @click="loadMore"
              :disabled="loadingMore"
              class="px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md disabled:opacity-50"
            >
              {{ loadingMore ? 'Loading...' : 'Load More' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Landlord Modal -->
    <AddEditLandlordModal
      v-if="showAddModal"
      :show="showAddModal"
      @close="showAddModal = false"
      @saved="handleLandlordSaved"
    />

    <!-- Edit Landlord Modal -->
    <AddEditLandlordModal
      v-if="showEditModal"
      :show="showEditModal"
      :landlord-id="editingLandlordId || undefined"
      @close="showEditModal = false; editingLandlordId = null"
      @saved="handleLandlordSaved"
    />

    <!-- Import CSV Modal -->
    <CSVImportModal
      v-if="showImportModal"
      :show="showImportModal"
      @close="showImportModal = false"
      @imported="handleCSVImported"
    />
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import Sidebar from '../components/Sidebar.vue'
import AddEditLandlordModal from '../components/AddEditLandlordModal.vue'
import CSVImportModal from '../components/CSVImportModal.vue'
import { useAuthStore } from '../stores/auth'
import { formatDate as formatUkDate } from '../utils/date'
import { Search, MoreVertical } from 'lucide-vue-next'
import { authFetch } from '@/lib/authFetch'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const landlords = ref<any[]>([])
const searchQuery = ref('')
const amlStatusFilter = ref('')
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingLandlordId = ref<string | null>(null)
const showImportModal = ref(false)
const actionsMenuOpen = ref<string | null>(null)
const selectedLandlords = ref<Set<string>>(new Set())
const bulkDeleting = ref(false)

// Pagination state
const currentPage = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)
const pageSize = 50

// Debounce timer for search
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Watch for search/filter changes and re-fetch from server
watch(searchQuery, () => {
  // Debounce search to avoid too many requests
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    fetchLandlords(1, false)
  }, 300)
})

watch(amlStatusFilter, () => {
  currentPage.value = 1
  fetchLandlords(1, false)
})

const fetchLandlords = async (page = 1, append = false) => {
  if (page === 1) {
    loading.value = true
  } else {
    loadingMore.value = true
  }
  error.value = ''

  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: pageSize.toString()
    })

    // Send search and filter to backend
    if (searchQuery.value) {
      params.set('search', searchQuery.value)
    }
    if (amlStatusFilter.value) {
      params.set('aml_status', amlStatusFilter.value)
    }

    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/landlords?${params}`, { token })

    if (!response.ok) {
      throw new Error('Failed to fetch landlords')
    }

    const data = await response.json()

    if (append) {
      landlords.value = [...landlords.value, ...(data.landlords || [])]
    } else {
      landlords.value = data.landlords || []
    }

    // Update pagination state
    if (data.pagination) {
      currentPage.value = data.pagination.page
      totalPages.value = data.pagination.totalPages
      totalCount.value = data.pagination.total
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load landlords'
    toast.error('Failed to load landlords')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => {
  if (currentPage.value < totalPages.value && !loadingMore.value) {
    fetchLandlords(currentPage.value + 1, true)
  }
}

const hasMorePages = computed(() => currentPage.value < totalPages.value)

const outdatedAmlLandlords = computed(() => {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 2)
  return landlords.value.filter((landlord) => {
    if (!landlord.aml_completed_at) return false
    const completedAt = new Date(landlord.aml_completed_at)
    if (Number.isNaN(completedAt.getTime())) return false
    return completedAt < cutoff
  })
})

const viewLandlord = (id: string) => {
  router.push(`/landlords/${id}`)
}

const editLandlord = (id: string) => {
  editingLandlordId.value = id
  showEditModal.value = true
  actionsMenuOpen.value = null
}

const goToAmlRecheck = (id: string) => {
  router.push(`/landlords/${id}?tab=aml#aml-request`)
}

const deleteLandlord = async (id: string) => {
  if (!confirm('Are you sure you want to delete this landlord?')) {
    return
  }

  try {
    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/landlords/${id}`, {
      method: 'DELETE',
      token
    })

    if (!response.ok) {
      throw new Error('Failed to delete landlord')
    }

    toast.success('Landlord deleted successfully')
    fetchLandlords()
  } catch (err: any) {
    toast.error('Failed to delete landlord')
  } finally {
    actionsMenuOpen.value = null
  }
}

const toggleSelectAll = () => {
  if (selectedLandlords.value.size === landlords.value.length) {
    selectedLandlords.value.clear()
  } else {
    selectedLandlords.value = new Set(landlords.value.map(l => l.id))
  }
}

const toggleSelectLandlord = (id: string) => {
  if (selectedLandlords.value.has(id)) {
    selectedLandlords.value.delete(id)
  } else {
    selectedLandlords.value.add(id)
  }
  // Force reactivity
  selectedLandlords.value = new Set(selectedLandlords.value)
}

const clearSelection = () => {
  selectedLandlords.value.clear()
  selectedLandlords.value = new Set()
}

const bulkDeleteLandlords = async () => {
  const count = selectedLandlords.value.size
  if (!confirm(`Are you sure you want to delete ${count} landlord${count === 1 ? '' : 's'}? This action cannot be undone.`)) {
    return
  }

  bulkDeleting.value = true
  try {
    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/landlords/bulk-delete`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: Array.from(selectedLandlords.value) })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to delete landlords')
    }

    const result = await response.json()
    toast.success(`${result.deleted} landlord${result.deleted === 1 ? '' : 's'} deleted successfully`)
    clearSelection()
    fetchLandlords()
  } catch (err: any) {
    toast.error(err.message || 'Failed to delete landlords')
  } finally {
    bulkDeleting.value = false
  }
}

const requestIdVerification = async (id: string) => {
  try {
    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/landlords/${id}/request-id-verification`, {
      method: 'POST',
      token
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to send verification request')
    }

    toast.success('Verification request sent to landlord.')
    fetchLandlords()
  } catch (err: any) {
    toast.error(err.message || 'Failed to send verification request')
  } finally {
    actionsMenuOpen.value = null
  }
}

const toggleActionsMenu = (id: string) => {
  actionsMenuOpen.value = actionsMenuOpen.value === id ? null : id
}

const handleLandlordSaved = () => {
  showAddModal.value = false
  showEditModal.value = false
  editingLandlordId.value = null
  fetchLandlords()
}

const handleCSVImported = () => {
  showImportModal.value = false
  fetchLandlords()
}

const formatAMLStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    'not_requested': 'Not Requested',
    'requested': 'Requested',
    'pending': 'Pending',
    'submitted': 'Submitted',
    'passed': 'Passed',
    'failed': 'Failed',
    'satisfactory': 'AML Satisfactory',
    'unsatisfactory': 'AML Unsatisfactory'
  }
  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1)
}

const formatDate = (dateString?: string | null, fallback = 'n/a') =>
  formatUkDate(
    dateString,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    },
    fallback
  )

// Close menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.actions-menu-container')) {
    actionsMenuOpen.value = null
  }
}

onMounted(() => {
  fetchLandlords()
  document.addEventListener('click', handleClickOutside)

  // Check if we should open the add modal
  if (route.query.add === 'true') {
    showAddModal.value = true
    // Remove the query parameter from the URL
    router.replace('/landlords')
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

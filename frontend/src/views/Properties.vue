<template>
  <Sidebar>
    <div class="p-8 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
      <div class="mb-8">
        <!-- Header -->
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white">Properties</h2>
            <p class="mt-2 text-gray-600 dark:text-slate-400">Manage all property details and compliance</p>
          </div>
          <div class="flex gap-3">
            <router-link
              to="/settings/property-settings"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Property Settings
            </router-link>
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
              Add Property
            </button>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-4 gap-4 mb-6">
          <div class="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-900/50 p-4">
            <p class="text-sm text-gray-500 dark:text-slate-400">Total Properties</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ stats.total }}</p>
          </div>
          <div class="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-900/50 p-4">
            <p class="text-sm text-gray-500 dark:text-slate-400">Vacant</p>
            <p class="text-2xl font-bold text-gray-600 dark:text-slate-300">{{ stats.vacant }}</p>
          </div>
          <div class="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-900/50 p-4">
            <p class="text-sm text-gray-500 dark:text-slate-400">In Tenancy</p>
            <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ stats.inTenancy }}</p>
          </div>
          <div class="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-900/50 p-4">
            <p class="text-sm text-gray-500 dark:text-slate-400">Compliance Issues</p>
            <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ stats.complianceIssues }}</p>
          </div>
        </div>

        <!-- Search and Filters -->
        <div class="flex gap-3 mb-6 flex-wrap">
          <!-- Search Box -->
          <div class="relative flex-1 min-w-[200px]">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by address, postcode..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 rounded-md leading-5 bg-white dark:bg-slate-800 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search class="h-5 w-5 text-gray-400 dark:text-slate-500" />
            </div>
          </div>

          <!-- Compliance Status Filter -->
          <select
            v-model="complianceFilter"
            class="block pl-3 pr-10 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
          >
            <option value="">All Compliance</option>
            <option value="valid">Valid</option>
            <option value="expiring_soon">Expiring Soon</option>
            <option value="expired">Expired</option>
          </select>

          <!-- Status Filter -->
          <select
            v-model="statusFilter"
            class="block pl-3 pr-10 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="vacant">Vacant</option>
            <option value="in_tenancy">In Tenancy</option>
          </select>

          <!-- Landlord Filter -->
          <select
            v-model="landlordFilter"
            class="block pl-3 pr-10 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
          >
            <option value="">All Landlords</option>
            <option value="true">Has Landlord</option>
            <option value="false">No Landlord</option>
          </select>
        </div>

        <!-- Bulk Actions Bar -->
        <div
          v-if="selectedProperties.size > 0"
          class="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between"
        >
          <span class="text-sm font-medium text-gray-700 dark:text-slate-300">
            {{ selectedProperties.size }} propert{{ selectedProperties.size === 1 ? 'y' : 'ies' }} selected
          </span>
          <div class="flex gap-2">
            <button
              @click="clearSelection"
              class="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
            >
              Clear selection
            </button>
            <button
              @click="bulkArchiveProperties"
              :disabled="bulkProcessing"
              class="px-3 py-1.5 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-md disabled:opacity-50"
            >
              {{ bulkProcessing ? 'Processing...' : 'Archive Selected' }}
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 overflow-hidden">
          <div class="p-8 text-center text-gray-600 dark:text-slate-400">Loading properties...</div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg">
          {{ error }}
        </div>

        <!-- Properties Table -->
        <div v-else class="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 overflow-visible">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead class="bg-gray-50 dark:bg-slate-900">
                <tr>
                  <th scope="col" class="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      :checked="properties.length > 0 && selectedProperties.size === properties.length"
                      :indeterminate="selectedProperties.size > 0 && selectedProperties.size < properties.length"
                      @change="toggleSelectAll"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded"
                    />
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Property Address
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Landlord(s)
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Compliance
                  </th>
                  <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                    Next Expiry
                  </th>
                  <th scope="col" class="relative px-6 py-3">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                <tr v-if="properties.length === 0">
                  <td colspan="7" class="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                    No properties found
                  </td>
                </tr>
                <tr
                  v-for="property in properties"
                  :key="property.id"
                  class="hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                  :class="{ 'bg-primary/5': selectedProperties.has(property.id) }"
                  @click="viewProperty(property.id)"
                >
                  <td class="px-6 py-4 whitespace-nowrap" @click.stop>
                    <input
                      type="checkbox"
                      :checked="selectedProperties.has(property.id)"
                      @change="toggleSelectProperty(property.id)"
                      class="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded"
                    />
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center">
                      <div>
                        <div class="text-sm font-medium text-gray-900 dark:text-white">
                          {{ property.address || property.postcode }}
                        </div>
                        <div class="text-sm text-gray-500 dark:text-slate-400">{{ property.postcode }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span v-if="property.landlord_count === 0" class="text-sm text-gray-400 dark:text-slate-500">
                      No landlord
                    </span>
                    <span v-else class="text-sm text-gray-900 dark:text-white">
                      {{ property.landlord_count }} landlord{{ property.landlord_count === 1 ? '' : 's' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="getStatusClasses(property.status)"
                      class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                    >
                      {{ formatStatus(property.status) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="getComplianceClasses(property.compliance_status)"
                      class="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full"
                    >
                      <span :class="getComplianceDotClass(property.compliance_status)" class="w-2 h-2 rounded-full"></span>
                      {{ formatComplianceStatus(property.compliance_status) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                    {{ property.next_expiry_date ? formatDate(property.next_expiry_date) : '-' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
                    <div class="flex items-center justify-end gap-2">
                      <button
                        @click="deleteProperty(property.id)"
                        class="text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 p-1 transition-colors"
                        title="Delete property"
                      >
                        <Trash2 class="h-4 w-4" />
                      </button>
                      <div class="relative">
                        <button
                          @click="toggleActionsMenu(property.id)"
                          class="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1"
                        >
                          <MoreVertical class="h-5 w-5" />
                        </button>
                        <div
                          v-if="actionsMenuOpen === property.id"
                          class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 dark:ring-slate-700 z-10"
                        >
                          <div class="py-1">
                            <button
                              @click="viewProperty(property.id)"
                              class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                              View Details
                            </button>
                            <button
                              @click="editProperty(property.id)"
                              class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                              Edit
                            </button>
                            <button
                              @click="deleteProperty(property.id)"
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
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-slate-400">
              Showing {{ properties.length }} of {{ totalCount }} properties
            </span>
            <button
              v-if="hasMorePages"
              @click="loadMore"
              :disabled="loadingMore"
              class="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50"
            >
              {{ loadingMore ? 'Loading...' : 'Load More' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Property Modal -->
    <AddEditPropertyModal
      v-if="showAddModal"
      :show="showAddModal"
      @close="showAddModal = false"
      @saved="handlePropertySaved"
    />

    <!-- Edit Property Modal -->
    <AddEditPropertyModal
      v-if="showEditModal"
      :show="showEditModal"
      :property-id="editingPropertyId || undefined"
      @close="showEditModal = false; editingPropertyId = null"
      @saved="handlePropertySaved"
    />

    <!-- CSV Import Modal -->
    <PropertyCSVImportModal
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
import AddEditPropertyModal from '../components/properties/AddEditPropertyModal.vue'
import PropertyCSVImportModal from '../components/properties/PropertyCSVImportModal.vue'
import { useAuthStore } from '../stores/auth'
import { formatDate as formatUkDate } from '../utils/date'
import { Search, MoreVertical, Trash2 } from 'lucide-vue-next'
import { authFetch } from '@/lib/authFetch'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface Property {
  id: string
  address: string | null
  city: string | null
  postcode: string
  status: string
  property_type: string | null
  is_licensed: boolean
  landlord_count: number
  compliance_status: 'valid' | 'expiring_soon' | 'expired' | 'none'
  next_expiry_date: string | null
  created_at: string
}

interface PropertyStats {
  total: number
  vacant: number
  inTenancy: number
  complianceIssues: number
}

const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const properties = ref<Property[]>([])
const stats = ref<PropertyStats>({ total: 0, vacant: 0, inTenancy: 0, complianceIssues: 0 })
const searchQuery = ref('')
const complianceFilter = ref('')
const statusFilter = ref('')
const landlordFilter = ref('')
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingPropertyId = ref<string | null>(null)
const showImportModal = ref(false)
const actionsMenuOpen = ref<string | null>(null)
const selectedProperties = ref<Set<string>>(new Set())
const bulkProcessing = ref(false)

// Pagination state
const currentPage = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)
const pageSize = 50

// Debounce timer for search
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Watch for search/filter changes and re-fetch from server
watch(searchQuery, () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1
    fetchProperties(1, false)
  }, 300)
})

watch([complianceFilter, statusFilter, landlordFilter], () => {
  currentPage.value = 1
  fetchProperties(1, false)
})

const fetchStats = async () => {
  try {
    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/properties/stats`, { token })

    if (response.ok) {
      stats.value = await response.json()
    }
  } catch (err) {
    console.error('Failed to fetch stats:', err)
  }
}

const fetchProperties = async (page = 1, append = false) => {
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

    if (searchQuery.value) {
      params.set('search', searchQuery.value)
    }
    if (complianceFilter.value) {
      params.set('compliance_status', complianceFilter.value)
    }
    if (statusFilter.value) {
      params.set('status', statusFilter.value)
    }
    if (landlordFilter.value) {
      params.set('has_landlord', landlordFilter.value)
    }

    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/properties?${params}`, { token })

    if (!response.ok) {
      throw new Error('Failed to fetch properties')
    }

    const data = await response.json()

    if (append) {
      properties.value = [...properties.value, ...(data.properties || [])]
    } else {
      properties.value = data.properties || []
    }

    if (data.pagination) {
      currentPage.value = data.pagination.page
      totalPages.value = data.pagination.totalPages
      totalCount.value = data.pagination.total
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load properties'
    toast.error('Failed to load properties')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => {
  if (currentPage.value < totalPages.value && !loadingMore.value) {
    fetchProperties(currentPage.value + 1, true)
  }
}

const hasMorePages = computed(() => currentPage.value < totalPages.value)

const viewProperty = (id: string) => {
  router.push(`/properties/${id}`)
}

const editProperty = (id: string) => {
  editingPropertyId.value = id
  showEditModal.value = true
  actionsMenuOpen.value = null
}

const deleteProperty = async (id: string) => {
  if (!confirm('Are you sure you want to delete this property?')) return

  try {
    const token = authStore.session?.access_token
    const response = await authFetch(`${API_URL}/api/properties/${id}`, {
      method: 'DELETE',
      token
    })

    if (!response.ok) {
      throw new Error('Failed to delete property')
    }

    toast.success('Property deleted successfully')
    fetchProperties(1, false)
    fetchStats()
  } catch (err: any) {
    toast.error(err.message || 'Failed to delete property')
  }
  actionsMenuOpen.value = null
}

const toggleActionsMenu = (id: string) => {
  actionsMenuOpen.value = actionsMenuOpen.value === id ? null : id
}

const toggleSelectAll = () => {
  if (selectedProperties.value.size === properties.value.length) {
    selectedProperties.value.clear()
  } else {
    selectedProperties.value = new Set(properties.value.map(p => p.id))
  }
}

const toggleSelectProperty = (id: string) => {
  if (selectedProperties.value.has(id)) {
    selectedProperties.value.delete(id)
  } else {
    selectedProperties.value.add(id)
  }
}

const clearSelection = () => {
  selectedProperties.value.clear()
}

const bulkArchiveProperties = async () => {
  if (!confirm(`Are you sure you want to archive ${selectedProperties.value.size} properties?`)) return

  bulkProcessing.value = true
  try {
    const token = authStore.session?.access_token
    for (const id of selectedProperties.value) {
      await authFetch(`${API_URL}/api/properties/${id}`, {
        method: 'DELETE',
        token
      })
    }
    toast.success(`${selectedProperties.value.size} properties archived`)
    selectedProperties.value.clear()
    fetchProperties(1, false)
    fetchStats()
  } catch (err: any) {
    toast.error('Failed to archive some properties')
  } finally {
    bulkProcessing.value = false
  }
}

const handlePropertySaved = () => {
  showAddModal.value = false
  showEditModal.value = false
  editingPropertyId.value = null
  fetchProperties(1, false)
  fetchStats()
  toast.success('Property saved successfully')
}

const handleCSVImported = (result: { imported: number; skipped: number }) => {
  showImportModal.value = false
  toast.success(`Imported ${result.imported} properties (${result.skipped} skipped)`)
  fetchProperties(1, false)
  fetchStats()
}

const formatDate = (date: string) => {
  return formatUkDate(date)
}

const formatStatus = (status: string) => {
  return status === 'in_tenancy' ? 'In Tenancy' : 'Vacant'
}

const getStatusClasses = (status: string) => {
  return status === 'in_tenancy'
    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
    : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
}

const formatComplianceStatus = (status: string) => {
  const labels: Record<string, string> = {
    valid: 'Valid',
    expiring_soon: 'Expiring',
    expired: 'Expired',
    none: 'No Records'
  }
  return labels[status] || status
}

const getComplianceClasses = (status: string) => {
  const classes: Record<string, string> = {
    valid: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
    expiring_soon: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
    expired: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
    none: 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
  }
  return classes[status] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
}

const getComplianceDotClass = (status: string) => {
  const classes: Record<string, string> = {
    valid: 'bg-green-500',
    expiring_soon: 'bg-amber-500',
    expired: 'bg-red-500',
    none: 'bg-gray-400'
  }
  return classes[status] || 'bg-gray-400'
}

// Close actions menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.relative')) {
    actionsMenuOpen.value = null
  }
}

onMounted(() => {
  fetchStats()
  fetchProperties()
  document.addEventListener('click', handleClickOutside)

  // Check for query params
  if (route.query.add === 'true') {
    showAddModal.value = true
    router.replace('/properties')
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
})
</script>

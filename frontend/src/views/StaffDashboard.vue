<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <StaffHeader />

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Stats -->
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-5 mb-8">
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-500">Pending</div>
                <div class="mt-1 text-3xl font-semibold text-gray-500">{{ stats.pending || 0 }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-500">In Progress</div>
                <div class="mt-1 text-3xl font-semibold text-blue-600">{{ stats.in_progress || 0 }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-500">Pending Verification</div>
                <div class="mt-1 text-3xl font-semibold text-primary">{{ stats.pending_verification || 0 }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-500">Completed</div>
                <div class="mt-1 text-3xl font-semibold text-green-600">{{ stats.completed || 0 }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-white overflow-hidden shadow rounded-lg">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-1">
                <div class="text-sm font-medium text-gray-500">Total</div>
                <div class="mt-1 text-3xl font-semibold text-gray-900">{{ totalReferences }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white shadow rounded-lg p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Status</label>
            <select
              v-model="filters.status"
              @change="fetchReferences"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending (Not Started)</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Search</label>
            <input
              v-model="filters.search"
              @input="debouncedSearch"
              type="text"
              placeholder="Search by tenant name or email..."
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>
          <div class="flex items-end gap-2">
            <button
              @click="resetFilters"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md border border-gray-300"
            >
              Reset Filters
            </button>
            <router-link
              to="/staff/work-queue"
              class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Work Queue
            </router-link>
          </div>
        </div>
      </div>

      <!-- References Table -->
      <div class="bg-white shadow rounded-lg overflow-hidden">
        <div v-if="loading" class="p-8 text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p class="mt-2 text-gray-600">Loading references...</p>
        </div>

        <div v-else-if="references.length === 0" class="p-8 text-center text-gray-500">
          No references found
        </div>

        <table v-else class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="reference in references" :key="reference.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{{ reference.companies?.name || 'N/A' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {{ reference.tenant_first_name }} {{ reference.tenant_last_name }}
                </div>
                <div class="text-sm text-gray-500">{{ reference.tenant_email }}</div>
              </td>
              <td class="px-6 py-4">
                <div class="text-sm text-gray-900">{{ reference.property_address }}</div>
                <div class="text-sm text-gray-500">
                  {{ reference.property_city }}{{ reference.property_postcode ? ', ' + reference.property_postcode : '' }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="{
                    'bg-yellow-100 text-yellow-800': reference.status === 'pending',
                    'bg-blue-100 text-blue-800': reference.status === 'in_progress',
                    'bg-orange-100 text-orange-800': reference.status === 'pending_verification',
                    'bg-green-100 text-green-800': reference.status === 'completed',
                    'bg-red-100 text-red-800': reference.status === 'rejected',
                    'bg-gray-100 text-gray-800': reference.status === 'cancelled'
                  }"
                >
                  {{ formatStatus(reference.status) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(reference.submitted_at || reference.created_at) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  @click="viewReference(reference.id, reference.status)"
                  class="text-primary hover:text-primary/80"
                >
                  {{ reference.status === 'completed' ? 'View' : 'View & Verify' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import StaffHeader from '../components/StaffHeader.vue'

const router = useRouter()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const references = ref<any[]>([])
const stats = ref<any>({})
const loading = ref(true)
const filters = ref({
  status: 'pending_verification',
  search: ''
})

let searchTimeout: number | null = null

const totalReferences = computed(() => {
  return Object.values(stats.value).reduce((acc: number, val: any) => acc + (val || 0), 0)
})

onMounted(() => {
  fetchStats()
  fetchReferences()
})

const fetchStats = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/staff/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      stats.value = data.stats
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }
}

const fetchReferences = async () => {
  try {
    loading.value = true
    const token = authStore.session?.access_token
    if (!token) return

    const params = new URLSearchParams()
    if (filters.value.status) params.append('status', filters.value.status)
    if (filters.value.search) params.append('search', filters.value.search)

    const response = await fetch(`${API_URL}/api/staff/references?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      references.value = data.references
    }
  } catch (error) {
    console.error('Failed to fetch references:', error)
  } finally {
    loading.value = false
  }
}

const debouncedSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = window.setTimeout(() => {
    fetchReferences()
  }, 500)
}

const resetFilters = () => {
  filters.value = {
    status: '',
    search: ''
  }
  fetchReferences()
}

const viewReference = (id: string, status: string) => {
  if (status === 'completed') {
    router.push(`/staff/view/${id}`)
  } else {
    router.push(`/staff/verification/${id}`)
  }
}


const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (date: string) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
</script>

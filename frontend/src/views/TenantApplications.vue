<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-3xl font-bold text-gray-900">Sent Applications</h2>
            <p class="mt-2 text-gray-600">Track application forms sent to tenants</p>
          </div>
          <router-link to="/tenant-applications/create"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md inline-block">
            Send New Application
          </router-link>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-6">
          <div class="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            @click="statusFilter = ''">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Total Sent</div>
                  <div class="mt-1 text-3xl font-semibold text-gray-900">{{ applications.length }}</div>
                </div>
                <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            @click="statusFilter = 'pending'">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Awaiting Response</div>
                  <div class="mt-1 text-3xl font-semibold text-yellow-600">{{ statusCounts.pending }}</div>
                </div>
                <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            @click="statusFilter = 'submitted'">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Completed</div>
                  <div class="mt-1 text-3xl font-semibold text-green-600">{{ statusCounts.submitted }}</div>
                </div>
                <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Search and Filters -->
        <div class="space-y-3 mb-6">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input v-model="searchQuery" type="text" placeholder="Search by email or property address..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
          </div>

          <div class="flex gap-3">
            <div class="flex-1">
              <select v-model="statusFilter"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm">
                <option value="">All Statuses</option>
                <option value="pending">Awaiting Response</option>
                <option value="submitted">Completed</option>
              </select>
            </div>
            <button v-if="statusFilter || searchQuery" @click="clearFilters"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Clear Filters
            </button>
          </div>
        </div>

        <!-- Applications List -->
        <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
          <div class="text-gray-600">Loading applications...</div>
        </div>

        <div v-else-if="filteredApplications.length === 0" class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-500">No applications found</p>
          <router-link to="/tenant-applications/create"
            class="mt-4 inline-block px-4 py-2 text-sm font-medium text-primary hover:text-primary/80">
            Send your first application
          </router-link>
        </div>

        <div v-else class="bg-white shadow overflow-hidden sm:rounded-md">
          <ul class="divide-y divide-gray-200">
            <li v-for="app in filteredApplications" :key="app.id" class="hover:bg-gray-50">
              <div class="px-6 py-4">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="flex items-center">
                      <h3 class="text-lg font-medium text-gray-900">
                        {{ app.property_address }}
                      </h3>
                      <span
                        class="ml-3 px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                        :class="getStatusBadgeClass(app.status)">
                        {{ formatStatus(app.status) }}
                      </span>
                    </div>
                    <div class="mt-2 text-sm text-gray-500">
                      <p><strong>Applicant Email:</strong> {{ app.applicant_email }}</p>
                      <p><strong>Sent:</strong> {{ formatDate(app.created_at) }}</p>
                      <p v-if="app.submitted_at"><strong>Submitted:</strong> {{ formatDate(app.submitted_at) }}</p>
                    </div>
                  </div>
                  <div class="ml-4 flex-shrink-0 flex flex-col gap-2 items-end">
                    <button v-if="app.status === 'submitted'" @click="viewApplication(app.id)"
                      class="px-4 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md">
                      View Details
                    </button>
                    <button v-if="app.status === 'pending'" @click="resendApplication(app.id)"
                      :disabled="resendingId === app.id"
                      class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                      {{ resendingId === app.id ? 'Sending...' : 'Resend' }}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import { formatDate } from '../utils/date'

const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const applications = ref<any[]>([])
const loading = ref(false)
const searchQuery = ref('')
const statusFilter = ref('')
const resendingId = ref<string | null>(null)

const statusCounts = computed(() => {
  const counts = {
    pending: 0,
    submitted: 0
  }

  for (const app of applications.value) {
    if (app.status === 'pending') {
      counts.pending++
    } else if (app.status === 'submitted') {
      counts.submitted++
    }
  }

  return counts
})

const filteredApplications = computed(() => {
  let filtered = applications.value

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter((app: any) => {
      const email = app.applicant_email?.toLowerCase() || ''
      const address = app.property_address?.toLowerCase() || ''
      return email.includes(query) || address.includes(query)
    })
  }

  // Apply status filter
  if (statusFilter.value) {
    filtered = filtered.filter((app: any) => app.status === statusFilter.value)
  }

  return filtered
})

const formatStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: 'Awaiting Response',
    submitted: 'Completed'
  }
  return statusMap[status] || status
}

const getStatusBadgeClass = (status: string) => {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-green-100 text-green-800'
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

const clearFilters = () => {
  searchQuery.value = ''
  statusFilter.value = ''
}

const viewApplication = (applicationId: string) => {
  router.push(`/applications/${applicationId}`)
}

const resendApplication = async (applicationId: string) => {
  resendingId.value = applicationId
  try {
    const token = authStore.session?.access_token
    if (!token) {
      router.push('/login')
      return
    }

    const response = await fetch(`${API_URL}/api/tenant-applications/${applicationId}/resend`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to resend application')
    }

    toast.success(`Application resent to ${data.email}`)
  } catch (error: any) {
    console.error('Error resending application:', error)
    toast.error(error.message || 'Failed to resend application')
  } finally {
    resendingId.value = null
  }
}

const fetchApplications = async () => {
  loading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) {
      router.push('/login')
      return
    }

    const response = await fetch(`${API_URL}/api/tenant-applications`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch applications')
    }

    const data = await response.json()
    applications.value = data.applications || []
  } catch (error: any) {
    console.error('Error fetching applications:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchApplications()
})
</script>

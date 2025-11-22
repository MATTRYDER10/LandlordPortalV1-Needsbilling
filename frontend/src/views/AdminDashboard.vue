<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p class="mt-1 text-sm text-gray-600">PropertyGoose Platform Analytics</p>
          </div>
          <router-link
            to="/admin/staff"
            class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Manage Staff
          </router-link>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Date Selector -->
      <div class="bg-white rounded-lg shadow p-6 mb-8">
        <div class="flex items-center gap-4 flex-wrap">
          <label class="text-sm font-medium text-gray-700">Select Date:</label>
          <div class="flex gap-2">
            <button
              @click="setDateFilter('today')"
              :class="dateFilter === 'today' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Today
            </button>
            <button
              @click="setDateFilter('yesterday')"
              :class="dateFilter === 'yesterday' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Yesterday
            </button>
            <input
              type="date"
              v-model="customDate"
              @change="setDateFilter('custom')"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>

      <!-- Statistics Grid -->
      <div v-else>
        <!-- Quick Stats (Today vs Yesterday) -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <!-- References Submitted -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600">References Submitted</p>
                <p class="mt-2 text-3xl font-bold text-gray-900">{{ currentStats.referencesSubmitted }}</p>
                <p class="mt-1 text-xs text-gray-500">{{ dateFilterLabel }}</p>
              </div>
              <div class="p-3 bg-blue-100 rounded-full">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
          </div>

          <!-- References Completed -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600">References Completed</p>
                <p class="mt-2 text-3xl font-bold text-gray-900">{{ currentStats.referencesCompleted }}</p>
                <p class="mt-1 text-xs text-gray-500">{{ dateFilterLabel }}</p>
              </div>
              <div class="p-3 bg-green-100 rounded-full">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
          </div>

          <!-- New Businesses -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600">New Businesses</p>
                <p class="mt-2 text-3xl font-bold text-gray-900">{{ currentStats.newBusinesses }}</p>
                <p class="mt-1 text-xs text-gray-500">{{ dateFilterLabel }}</p>
              </div>
              <div class="p-3 bg-purple-100 rounded-full">
                <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
              </div>
            </div>
          </div>

          <!-- Revenue -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600">Total Revenue</p>
                <p class="mt-2 text-3xl font-bold text-gray-900">£{{ currentStats.revenue }}</p>
                <p class="mt-1 text-xs text-gray-500">{{ dateFilterLabel }}</p>
              </div>
              <div class="p-3 bg-yellow-100 rounded-full">
                <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Overall Platform Stats -->
        <div class="bg-white rounded-lg shadow p-6 mb-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Platform Totals</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="border-l-4 border-blue-500 pl-4">
              <p class="text-sm text-gray-600">Total Companies</p>
              <p class="text-2xl font-bold text-gray-900">{{ dashboardData.totals?.companies || 0 }}</p>
            </div>
            <div class="border-l-4 border-green-500 pl-4">
              <p class="text-sm text-gray-600">Total References</p>
              <p class="text-2xl font-bold text-gray-900">{{ dashboardData.totals?.references || 0 }}</p>
            </div>
            <div class="border-l-4 border-purple-500 pl-4">
              <p class="text-sm text-gray-600">Active Staff</p>
              <p class="text-2xl font-bold text-gray-900">{{ dashboardData.totals?.activeStaff || 0 }}</p>
            </div>
          </div>
        </div>

        <!-- New Companies List -->
        <div class="bg-white rounded-lg shadow">
          <div class="px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg font-semibold text-gray-900">Recent Companies</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credits</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onboarding</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-if="loadingCompanies">
                  <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                    <div class="flex justify-center">
                      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
                <tr v-else-if="companies.length === 0">
                  <td colspan="6" class="px-6 py-4 text-center text-gray-500">No companies found</td>
                </tr>
                <tr v-else v-for="company in companies" :key="company.id" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ company.companyName || 'N/A' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ company.owner?.name || 'N/A' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ company.owner?.email || company.companyEmail || 'N/A' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ company.credits || 0 }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="company.onboardingCompleted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'"
                      class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                    >
                      {{ company.onboardingCompleted ? 'Complete' : 'Incomplete' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ formatDate(company.createdAt) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface DashboardData {
  today?: {
    referencesSubmitted: number
    referencesCompleted: number
    newBusinesses: number
    revenue: string
  }
  yesterday?: {
    referencesSubmitted: number
    referencesCompleted: number
    newBusinesses: number
    revenue: string
  }
  totals?: {
    companies: number
    references: number
    activeStaff: number
  }
}

interface Company {
  id: string
  companyName: string
  companyEmail: string
  createdAt: string
  onboardingCompleted: boolean
  credits: number
  owner: {
    name: string
    email: string
  } | null
}

const dateFilter = ref<'today' | 'yesterday' | 'custom'>('today')
const customDate = ref('')
const loading = ref(true)
const loadingCompanies = ref(true)
const dashboardData = ref<DashboardData>({})
const companies = ref<Company[]>([])

const currentStats = computed(() => {
  if (dateFilter.value === 'yesterday') {
    return dashboardData.value.yesterday || {
      referencesSubmitted: 0,
      referencesCompleted: 0,
      newBusinesses: 0,
      revenue: '0.00'
    }
  }
  return dashboardData.value.today || {
    referencesSubmitted: 0,
    referencesCompleted: 0,
    newBusinesses: 0,
    revenue: '0.00'
  }
})

const dateFilterLabel = computed(() => {
  if (dateFilter.value === 'today') return 'Today'
  if (dateFilter.value === 'yesterday') return 'Yesterday'
  return customDate.value
})

const setDateFilter = (filter: 'today' | 'yesterday' | 'custom') => {
  dateFilter.value = filter
  if (filter !== 'custom') {
    customDate.value = ''
  }
  if (filter === 'custom' && customDate.value) {
    fetchCustomDateStats()
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

const fetchDashboardData = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const response = await axios.get(`${API_URL}/api/admin/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    dashboardData.value = response.data
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    alert('Failed to load dashboard data')
  } finally {
    loading.value = false
  }
}

const fetchCompanies = async () => {
  loadingCompanies.value = true
  try {
    const token = localStorage.getItem('token')
    const response = await axios.get(`${API_URL}/api/admin/companies/new?limit=20`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    companies.value = response.data.companies
  } catch (error) {
    console.error('Error fetching companies:', error)
  } finally {
    loadingCompanies.value = false
  }
}

const fetchCustomDateStats = async () => {
  if (!customDate.value) return

  loading.value = true
  try {
    const token = localStorage.getItem('token')

    // Fetch custom date stats (we'll add them to today's stats for display)
    const [refsResponse, businessResponse, revenueResponse] = await Promise.all([
      axios.get(`${API_URL}/api/admin/statistics/references?date=${customDate.value}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get(`${API_URL}/api/admin/statistics/businesses?date=${customDate.value}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      axios.get(`${API_URL}/api/admin/statistics/revenue?date=${customDate.value}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ])

    // Update today's stats with custom date data
    dashboardData.value.today = {
      referencesSubmitted: refsResponse.data.statistics.submitted,
      referencesCompleted: refsResponse.data.statistics.completed,
      newBusinesses: businessResponse.data.statistics.newBusinesses,
      revenue: revenueResponse.data.statistics.totalRevenue
    }
  } catch (error) {
    console.error('Error fetching custom date stats:', error)
    alert('Failed to load statistics for selected date')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardData()
  fetchCompanies()
})
</script>

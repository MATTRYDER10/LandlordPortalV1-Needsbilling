<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <div class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Customer Management</h1>
            <p class="mt-1 text-sm text-gray-600">Search and manage customer accounts</p>
          </div>
          <router-link
            to="/admin/dashboard"
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Back to Dashboard
          </router-link>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Search Section -->
      <div class="bg-white rounded-lg shadow p-6 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Search Companies</h2>
        <div class="relative">
          <input
            v-model="searchQuery"
            @input="handleSearch"
            type="text"
            placeholder="Search by company name or email..."
            class="w-full px-4 py-3 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <svg
            class="absolute left-3 top-3.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="mt-4 border border-gray-200 rounded-md overflow-hidden">
          <div class="divide-y divide-gray-200">
            <div
              v-for="company in searchResults"
              :key="company.id"
              @click="selectCompany(company.id)"
              class="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ company.name }}</p>
                  <p class="text-sm text-gray-500">{{ company.email }}</p>
                </div>
                <div class="text-right">
                  <p class="text-sm text-gray-600">{{ company.reference_credits }} credits</p>
                  <p class="text-xs text-gray-400">Since {{ formatDate(company.created_at) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="searchQuery.length >= 2 && !searching" class="mt-4 text-center text-gray-500">
          No companies found
        </div>
      </div>

      <!-- Selected Company Details -->
      <div v-if="selectedCompanyDetails" class="space-y-6">
        <!-- Company Header -->
        <div class="bg-white rounded-lg shadow p-6">
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-2xl font-bold text-gray-900">{{ selectedCompanyDetails.company.name }}</h2>
              <p class="text-sm text-gray-600 mt-1">{{ selectedCompanyDetails.company.email }}</p>
              <p class="text-xs text-gray-500 mt-1">
                Member since {{ formatDate(selectedCompanyDetails.company.created_at) }}
              </p>
            </div>
            <span
              :class="
                selectedCompanyDetails.company.onboarding_completed
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              "
              class="px-3 py-1 text-sm font-semibold rounded-full"
            >
              {{ selectedCompanyDetails.company.onboarding_completed ? 'Active' : 'Onboarding' }}
            </span>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-1">
                <p class="text-sm text-gray-600">Current Credits</p>
                <p class="text-2xl font-bold text-blue-600 mt-1">
                  {{ selectedCompanyDetails.company.reference_credits }}
                </p>
              </div>
              <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-1">
                <p class="text-sm text-gray-600">Total References</p>
                <p class="text-2xl font-bold text-purple-600 mt-1">
                  {{ selectedCompanyDetails.stats.totalReferences }}
                </p>
              </div>
              <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-1">
                <p class="text-sm text-gray-600">Total Spent</p>
                <p class="text-2xl font-bold text-green-600 mt-1">
                  £{{ selectedCompanyDetails.stats.totalSpent }}
                </p>
              </div>
              <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center">
              <div class="flex-1">
                <p class="text-sm text-gray-600">Team Size</p>
                <p class="text-2xl font-bold text-orange-600 mt-1">
                  {{ selectedCompanyDetails.stats.teamSize }}
                </p>
              </div>
              <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Credit Management -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Credit Management</h3>
          <div class="flex items-end gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">Credits Adjustment</label>
              <input
                v-model.number="creditAdjustment"
                type="number"
                placeholder="Enter amount (positive to add, negative to remove)"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input
                v-model="creditReason"
                type="text"
                placeholder="Enter reason for adjustment"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <button
              @click="adjustCredits"
              :disabled="!creditAdjustment || creditAdjustment === 0 || !creditReason || adjustingCredits"
              class="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ adjustingCredits ? 'Adjusting...' : 'Adjust Credits' }}
            </button>
          </div>
          <p class="text-sm text-gray-500 mt-2">
            Current balance: <span class="font-semibold">{{ selectedCompanyDetails.company.reference_credits }}</span> credits
          </p>
        </div>

        <!-- Tabs -->
        <div class="bg-white rounded-lg shadow">
          <div class="border-b border-gray-200">
            <nav class="flex -mb-px">
              <button
                @click="activeTab = 'credits'"
                :class="activeTab === 'credits' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
                class="py-4 px-6 border-b-2 font-medium text-sm transition-colors"
              >
                Credit History
              </button>
              <button
                @click="activeTab = 'references'"
                :class="activeTab === 'references' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
                class="py-4 px-6 border-b-2 font-medium text-sm transition-colors"
              >
                References
              </button>
              <button
                @click="activeTab = 'team'"
                :class="activeTab === 'team' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
                class="py-4 px-6 border-b-2 font-medium text-sm transition-colors"
              >
                Team Members
              </button>
            </nav>
          </div>

          <!-- Tab Content -->
          <div class="p-6">
            <!-- Credit History Tab -->
            <div v-if="activeTab === 'credits'">
              <div v-if="selectedCompanyDetails.creditTransactions.length === 0" class="text-center text-gray-500 py-8">
                No credit transactions found
              </div>
              <div v-else class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance After</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr v-for="tx in selectedCompanyDetails.creditTransactions" :key="tx.id">
                      <td class="px-4 py-3 text-sm text-gray-500">{{ formatDateTime(tx.created_at) }}</td>
                      <td class="px-4 py-3 text-sm">
                        <span class="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                          {{ formatTransactionType(tx.type) }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm">
                        <span :class="tx.credits_change > 0 ? 'text-green-600' : 'text-red-600'" class="font-semibold">
                          {{ tx.credits_change > 0 ? '+' : '' }}{{ tx.credits_change }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-900">
                        {{ tx.amount_gbp ? `£${parseFloat(tx.amount_gbp).toFixed(2)}` : '-' }}
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-900">{{ tx.credits_balance_after }}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{{ tx.description }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- References Tab -->
            <div v-if="activeTab === 'references'">
              <div v-if="selectedCompanyDetails.references.length === 0" class="text-center text-gray-500 py-8">
                No references found
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="ref in selectedCompanyDetails.references"
                  :key="ref.id"
                  class="border border-gray-200 rounded-md p-4 hover:bg-gray-50 transition-colors"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-gray-900">Reference #{{ ref.id.slice(0, 8) }}</p>
                      <p class="text-xs text-gray-500 mt-1">{{ formatDateTime(ref.created_at) }}</p>
                    </div>
                    <span
                      :class="getStatusColor(ref.status)"
                      class="px-2 py-1 text-xs font-semibold rounded-full"
                    >
                      {{ ref.status }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Team Members Tab -->
            <div v-if="activeTab === 'team'">
              <div v-if="selectedCompanyDetails.teamMembers.length === 0" class="text-center text-gray-500 py-8">
                No team members found
              </div>
              <div v-else class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr v-for="member in selectedCompanyDetails.teamMembers" :key="member.id">
                      <td class="px-4 py-3 text-sm text-gray-900">{{ member.user?.email || 'N/A' }}</td>
                      <td class="px-4 py-3 text-sm">
                        <span
                          :class="member.role === 'owner' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'"
                          class="px-2 py-1 text-xs font-semibold rounded-full"
                        >
                          {{ member.role }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-500">{{ formatDate(member.joined_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const searchQuery = ref('')
const searchResults = ref<any[]>([])
const searching = ref(false)
const selectedCompanyDetails = ref<any>(null)
const activeTab = ref<'credits' | 'references' | 'team'>('credits')
const creditAdjustment = ref<number | null>(null)
const creditReason = ref('')
const adjustingCredits = ref(false)

let searchTimeout: NodeJS.Timeout | null = null

const handleSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }

  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }

  searchTimeout = setTimeout(async () => {
    searching.value = true
    try {
      const token = authStore.session?.access_token
      const response = await axios.get(`${API_URL}/api/admin/customers/search?query=${searchQuery.value}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      searchResults.value = response.data.customers
    } catch (error) {
      console.error('Error searching companies:', error)
    } finally {
      searching.value = false
    }
  }, 300)
}

const selectCompany = async (companyId: string) => {
  try {
    const token = authStore.session?.access_token
    const response = await axios.get(`${API_URL}/api/admin/customers/${companyId}/details`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    selectedCompanyDetails.value = response.data
    // Reset credit adjustment form
    creditAdjustment.value = null
    creditReason.value = ''
  } catch (error) {
    console.error('Error fetching company details:', error)
    alert('Failed to load company details')
  }
}

const adjustCredits = async () => {
  if (!selectedCompanyDetails.value || !creditAdjustment.value || !creditReason.value) {
    return
  }

  if (!confirm(`Adjust credits by ${creditAdjustment.value}? Current: ${selectedCompanyDetails.value.company.reference_credits}, New: ${selectedCompanyDetails.value.company.reference_credits + creditAdjustment.value}`)) {
    return
  }

  adjustingCredits.value = true
  try {
    const token = authStore.session?.access_token
    const response = await axios.post(
      `${API_URL}/api/admin/customers/${selectedCompanyDetails.value.company.id}/credits`,
      {
        amount: creditAdjustment.value,
        reason: creditReason.value
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    alert(response.data.message)

    // Reload company details
    await selectCompany(selectedCompanyDetails.value.company.id)

    // Reset form
    creditAdjustment.value = null
    creditReason.value = ''
  } catch (error: any) {
    console.error('Error adjusting credits:', error)
    alert(error.response?.data?.error || 'Failed to adjust credits')
  } finally {
    adjustingCredits.value = false
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

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const formatTransactionType = (type: string) => {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    submitted: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800'
  }
  return colors[status] || 'bg-gray-100 text-gray-800'
}
</script>

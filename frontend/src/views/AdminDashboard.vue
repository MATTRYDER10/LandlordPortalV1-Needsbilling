<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <div class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p class="mt-1 text-sm text-gray-600">PropertyGoose Platform Analytics</p>
          </div>
          <div class="flex gap-3">
            <router-link
              to="/admin/customers"
              class="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Manage Customers
            </router-link>
            <router-link
              to="/admin/staff"
              class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              Manage Staff
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Date Selector -->
      <div class="bg-white shadow rounded-lg p-4 mb-6">
        <div class="flex items-center gap-4 flex-wrap">
          <label class="text-sm font-medium text-gray-700">Select Date:</label>
          <div class="flex gap-2 flex-wrap">
            <button
              @click="setDateFilter('today')"
              :class="dateFilter === 'today' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Today
            </button>
            <button
              @click="setDateFilter('yesterday')"
              :class="dateFilter === 'yesterday' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Yesterday
            </button>
            <button
              @click="setDateFilter('7days')"
              :class="dateFilter === '7days' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Last 7 Days
            </button>
            <button
              @click="setDateFilter('14days')"
              :class="dateFilter === '14days' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Last 14 Days
            </button>
            <button
              @click="setDateFilter('30days')"
              :class="dateFilter === '30days' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium transition-colors"
            >
              Last 30 Days
            </button>
            <input
              type="date"
              v-model="customDate"
              @change="setDateFilter('custom')"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>

      <!-- Statistics Grid -->
      <div v-else>
        <!-- Quick Stats (Today vs Yesterday) -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <!-- References Submitted -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-600">References Submitted</div>
                  <div class="mt-2 text-3xl font-semibold text-gray-900">{{ currentStats.referencesSubmitted }}</div>
                  <div class="mt-1 text-xs text-gray-500">{{ dateFilterLabel }}</div>
                </div>
                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- References Completed -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-600">References Completed</div>
                  <div class="mt-2 text-3xl font-semibold text-green-600">{{ currentStats.referencesCompleted }}</div>
                  <div class="mt-1 text-xs text-gray-500">{{ dateFilterLabel }}</div>
                </div>
                <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- New Businesses -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-600">New Businesses</div>
                  <div class="mt-2 text-3xl font-semibold text-primary">{{ currentStats.newBusinesses }}</div>
                  <div class="mt-1 text-xs text-gray-500">{{ dateFilterLabel }}</div>
                </div>
                <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Revenue -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-600">Total Revenue</div>
                  <div class="mt-2 text-3xl font-semibold text-gray-900">£{{ currentStats.revenue }}</div>
                  <div class="mt-1 text-xs text-gray-500">{{ dateFilterLabel }}</div>
                </div>
                <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Credits Added -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-600">Credits Added</div>
                  <div class="mt-2 text-3xl font-semibold text-purple-600">{{ currentStats.creditsAdded }}</div>
                  <div class="mt-1 text-xs text-gray-500">{{ dateFilterLabel }}</div>
                </div>
                <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Credits Used -->
          <div class="bg-white overflow-hidden shadow rounded-lg">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-600">Credits Used</div>
                  <div class="mt-2 text-3xl font-semibold text-red-600">{{ currentStats.creditsUsed }}</div>
                  <div class="mt-1 text-xs text-gray-500">{{ dateFilterLabel }}</div>
                </div>
                <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Staff Performance Leaderboard -->
        <div class="bg-white shadow rounded-lg mb-8">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-gray-900">Staff Performance Leaderboard</h2>
                <p class="mt-1 text-sm text-gray-600">Verification progress for {{ dateFilterLabel.toLowerCase() }}</p>
              </div>
              <div class="text-right">
                <div class="text-sm text-gray-600">Total Steps Completed</div>
                <div class="text-2xl font-bold text-primary">{{ performanceData.totals?.stepsCompleted || 0 }}</div>
              </div>
            </div>
          </div>

          <div v-if="loadingPerformance" class="p-6 flex justify-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>

          <div v-else-if="performanceData.leaderboard && performanceData.leaderboard.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Steps Completed</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">References Verified</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pass Rate</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Step Breakdown</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="(staff, index) in performanceData.leaderboard"
                  :key="staff.staffId"
                  :class="index === 0 && staff.stepsCompleted > 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'"
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <span
                        v-if="index === 0 && staff.stepsCompleted > 0"
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-400 text-white font-bold text-sm"
                      >
                        🏆
                      </span>
                      <span
                        v-else-if="index === 1 && staff.stepsCompleted > 0"
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-white font-bold text-sm"
                      >
                        2
                      </span>
                      <span
                        v-else-if="index === 2 && staff.stepsCompleted > 0"
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-300 text-white font-bold text-sm"
                      >
                        3
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-medium text-sm"
                      >
                        {{ index + 1 }}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">{{ staff.staffName }}</div>
                    <div class="text-sm text-gray-500">{{ staff.email }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-lg font-semibold text-primary">{{ staff.stepsCompleted }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-lg font-semibold text-green-600">{{ staff.referencesVerified }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <span
                        :class="getPassRateColor(staff.passRate)"
                        class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                      >
                        {{ staff.passRate }}%
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex gap-2 text-xs">
                      <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded">S1: {{ staff.stepBreakdown.step1 }}</span>
                      <span class="px-2 py-1 bg-green-100 text-green-800 rounded">S2: {{ staff.stepBreakdown.step2 }}</span>
                      <span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">S3: {{ staff.stepBreakdown.step3 }}</span>
                      <span class="px-2 py-1 bg-purple-100 text-purple-800 rounded">S4: {{ staff.stepBreakdown.step4 }}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="p-6 text-center text-gray-500">
            No verification activity for this period
          </div>
        </div>

        <!-- Customer Leaderboard -->
        <div class="bg-white shadow rounded-lg mb-8">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-gray-900">Customer Leaderboard</h2>
                <p class="mt-1 text-sm text-gray-600">Top performing companies</p>
              </div>
              <div class="flex gap-2">
                <button
                  @click="sortCustomersBy('references')"
                  :class="customerSortBy === 'references' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
                  class="px-3 py-1 text-sm rounded border border-gray-300 transition-colors"
                >
                  By References
                </button>
                <button
                  @click="sortCustomersBy('spent')"
                  :class="customerSortBy === 'spent' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
                  class="px-3 py-1 text-sm rounded border border-gray-300 transition-colors"
                >
                  By Spending
                </button>
                <button
                  @click="sortCustomersBy('teamSize')"
                  :class="customerSortBy === 'teamSize' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
                  class="px-3 py-1 text-sm rounded border border-gray-300 transition-colors"
                >
                  By Team Size
                </button>
              </div>
            </div>
          </div>

          <div v-if="loadingCustomers" class="p-6 flex justify-center">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>

          <div v-else-if="customerLeaderboard.length > 0" class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total References</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Size</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member Since</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="(customer, index) in customerLeaderboard"
                  :key="customer.companyId"
                  :class="index < 3 ? 'bg-yellow-50' : 'hover:bg-gray-50'"
                  class="transition-colors"
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <span v-if="index === 0" class="text-2xl mr-2">🏆</span>
                      <span class="text-sm font-medium text-gray-900">{{ index + 1 }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">{{ customer.companyName }}</div>
                    <div class="text-sm text-gray-500">{{ customer.companyEmail }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-semibold text-blue-600">{{ customer.totalReferences }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-semibold text-green-600">£{{ customer.totalSpent }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center text-sm text-gray-900">
                      <svg class="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                      </svg>
                      {{ customer.teamSize }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ formatDate(customer.memberSince) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      :class="customer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                      class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                    >
                      {{ customer.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="p-6 text-center text-gray-500">
            No customer data available
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
                      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
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
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface DashboardData {
  today?: {
    referencesSubmitted: number
    referencesCompleted: number
    newBusinesses: number
    revenue: string
    creditsAdded: number
    creditsUsed: number
  }
  yesterday?: {
    referencesSubmitted: number
    referencesCompleted: number
    newBusinesses: number
    revenue: string
    creditsAdded: number
    creditsUsed: number
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

interface StaffPerformance {
  staffId: string
  staffName: string
  email: string
  stepsCompleted: number
  referencesVerified: number
  passRate: number
  stepBreakdown: {
    step1: number
    step2: number
    step3: number
    step4: number
  }
}

interface PerformanceData {
  totals?: {
    stepsCompleted: number
    referencesVerified: number
    activeStaff: number
  }
  leaderboard: StaffPerformance[]
}

interface CustomerLeaderboard {
  companyId: string
  companyName: string
  companyEmail: string
  totalReferences: number
  totalSpent: string
  teamSize: number
  memberSince: string
  currentCredits: number
  isActive: boolean
}

const dateFilter = ref<'today' | 'yesterday' | '7days' | '14days' | '30days' | 'custom'>('today')
const customDate = ref('')
const loading = ref(true)
const loadingCompanies = ref(true)
const loadingPerformance = ref(true)
const loadingCustomers = ref(true)
const dashboardData = ref<DashboardData>({})
const companies = ref<Company[]>([])
const performanceData = ref<PerformanceData>({ leaderboard: [] })
const customerLeaderboard = ref<CustomerLeaderboard[]>([])
const customerSortBy = ref<'references' | 'spent' | 'teamSize'>('references')

const currentStats = computed(() => {
  if (dateFilter.value === 'yesterday') {
    return dashboardData.value.yesterday || {
      referencesSubmitted: 0,
      referencesCompleted: 0,
      newBusinesses: 0,
      revenue: '0.00',
      creditsAdded: 0,
      creditsUsed: 0
    }
  }
  return dashboardData.value.today || {
    referencesSubmitted: 0,
    referencesCompleted: 0,
    newBusinesses: 0,
    revenue: '0.00',
    creditsAdded: 0,
    creditsUsed: 0
  }
})

const dateFilterLabel = computed(() => {
  if (dateFilter.value === 'today') return 'Today'
  if (dateFilter.value === 'yesterday') return 'Yesterday'
  if (dateFilter.value === '7days') return 'Last 7 Days'
  if (dateFilter.value === '14days') return 'Last 14 Days'
  if (dateFilter.value === '30days') return 'Last 30 Days'
  return customDate.value
})

const setDateFilter = (filter: 'today' | 'yesterday' | '7days' | '14days' | '30days' | 'custom') => {
  dateFilter.value = filter
  if (filter !== 'custom') {
    customDate.value = ''
  }
  if (filter === 'custom' && customDate.value) {
    fetchCustomDateStats()
  } else if (filter === '7days' || filter === '14days' || filter === '30days') {
    fetchDateRangeStats(filter)
  } else {
    fetchPerformanceData()
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'N/A'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

const getPassRateColor = (passRate: number) => {
  if (passRate >= 90) return 'bg-green-100 text-green-800'
  if (passRate >= 75) return 'bg-blue-100 text-blue-800'
  if (passRate >= 60) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

const fetchDashboardData = async (dateRangeParam?: string) => {
  loading.value = true
  try {
    const token = authStore.session?.access_token
    const url = dateRangeParam
      ? `${API_URL}/api/admin/dashboard?dateRange=${dateRangeParam}`
      : `${API_URL}/api/admin/dashboard`
    const response = await axios.get(url, {
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
    const token = authStore.session?.access_token
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

const fetchPerformanceData = async () => {
  loadingPerformance.value = true
  try {
    const token = authStore.session?.access_token
    const dateParam = dateFilter.value === 'custom' ? customDate.value : dateFilter.value
    const response = await axios.get(`${API_URL}/api/admin/staff/performance?date=${dateParam}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    performanceData.value = response.data
  } catch (error) {
    console.error('Error fetching performance data:', error)
  } finally {
    loadingPerformance.value = false
  }
}

const fetchCustomerLeaderboard = async () => {
  loadingCustomers.value = true
  try {
    const token = authStore.session?.access_token
    const response = await axios.get(
      `${API_URL}/api/admin/customers/leaderboard?sortBy=${customerSortBy.value}&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )
    customerLeaderboard.value = response.data.leaderboard
  } catch (error) {
    console.error('Error fetching customer leaderboard:', error)
  } finally {
    loadingCustomers.value = false
  }
}

const sortCustomersBy = (sortBy: 'references' | 'spent' | 'teamSize') => {
  customerSortBy.value = sortBy
  fetchCustomerLeaderboard()
}

const fetchCustomDateStats = async () => {
  if (!customDate.value) return

  loading.value = true
  try {
    const token = authStore.session?.access_token

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
      revenue: revenueResponse.data.statistics.totalRevenue,
      creditsAdded: 0,
      creditsUsed: 0
    }
  } catch (error) {
    console.error('Error fetching custom date stats:', error)
    alert('Failed to load statistics for selected date')
  } finally {
    loading.value = false
  }

  // Also fetch performance data for the custom date
  fetchPerformanceData()
}

const fetchDateRangeStats = async (range: '7days' | '14days' | '30days') => {
  // Fetch dashboard data for the selected date range
  await fetchDashboardData(range)

  // Also fetch performance data for the date range
  fetchPerformanceData()
}

onMounted(() => {
  fetchDashboardData()
  fetchCompanies()
  fetchPerformanceData()
  fetchCustomerLeaderboard()
})
</script>

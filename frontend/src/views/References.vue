<template>
  <Sidebar>
    <div class="p-8">
      <div class="mb-8">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-3xl font-bold text-gray-900">References</h2>
            <p class="mt-2 text-gray-600">Manage all tenant references</p>
          </div>
          <button @click="showCreateModal = true"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md">
            Create New Reference
          </button>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-5 mb-6">
          <div class="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            @click="statusFilter = ''">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Total References</div>
                  <div class="mt-1 text-3xl font-semibold text-gray-900">{{ references.length }}</div>
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
            @click="statusFilter = 'in_progress'">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">In Progress</div>
                  <div class="mt-1 text-3xl font-semibold text-blue-600">{{ statusCounts.in_progress }}</div>
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
            @click="statusFilter = 'pending_verification'">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Pending Verification</div>
                  <div class="mt-1 text-3xl font-semibold text-primary">{{ statusCounts.pending_verification }}</div>
                </div>
                <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            @click="statusFilter = 'rejected'">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Rejected</div>
                  <div class="mt-1 text-3xl font-semibold text-red-600">{{ statusCounts.rejected }}</div>
                </div>
                <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            @click="statusFilter = 'completed'">
            <div class="p-5">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-500">Completed</div>
                  <div class="mt-1 text-3xl font-semibold text-green-600">{{ statusCounts.completed }}</div>
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
        <div class="space-y-3">
          <!-- Search Box -->
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input v-model="searchQuery" type="text" placeholder="Search by tenant name, email, or property address..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm" />
          </div>

          <!-- Filters -->
          <div class="flex gap-3">
            <div class="flex-1">
              <label for="status-filter" class="sr-only">Filter by Status</label>
              <select id="status-filter" v-model="statusFilter"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm">
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div class="flex-1">
              <label for="date-filter" class="sr-only">Filter by Date</label>
              <select id="date-filter" v-model="dateFilter"
                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm">
                <option value="">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 3 Months</option>
                <option value="year">Last Year</option>
              </select>
            </div>
            <button v-if="statusFilter || dateFilter" @click="clearFilters"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <!-- References List -->
      <div v-if="loading || filteredReferences.length > 0" class="bg-white rounded-lg shadow">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remark</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">References
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button @click="toggleSort('created_at')" class="flex items-center gap-1 hover:text-gray-700"
                    :class="{ 'text-primary': sortBy === 'created_at' }">
                    Created
                    <svg v-if="sortBy === 'created_at'" class="w-4 h-4" fill="none" stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path v-if="sortOrder === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M5 15l7-7 7 7" />
                      <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button @click="toggleSort('move_in_date')" class="flex items-center gap-1 hover:text-gray-700"
                    :class="{ 'text-primary': sortBy === 'move_in_date' }">
                    Move In Date
                    <svg v-if="sortBy === 'move_in_date'" class="w-4 h-4" fill="none" stroke="currentColor"
                      viewBox="0 0 24 24">
                      <path v-if="sortOrder === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M5 15l7-7 7 7" />
                      <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody v-if="loading" class="bg-white">
              <tr>
                <td class="px-6 py-4" style="width: 300px;">
                  <div class="text-sm text-gray-900">
                    <div class="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
                  </div>
                  <div class="text-sm text-gray-500 mt-1">
                    <div class="h-4 bg-gray-100 rounded w-40 animate-pulse"></div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap" style="width: 250px;">
                  <div class="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <div class="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                  </div>
                  <div class="text-sm text-gray-500 mt-1">
                    <div class="h-4 bg-gray-100 rounded w-48 animate-pulse"></div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap" style="width: 120px;">
                  <span
                    class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap" style="width: 200px;">
                  <div class="h-4 bg-gray-100 rounded w-32 animate-pulse"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap" style="width: 150px;">
                  <div class="flex items-center gap-3">
                    <div class="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
                    <div class="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
                    <div class="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" style="width: 150px;">
                  <div class="h-4 bg-gray-100 rounded w-28 animate-pulse"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500" style="width: 150px;">
                  <div class="h-4 bg-gray-100 rounded w-28 animate-pulse"></div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" style="width: 180px;">
                  <div class="h-4 bg-gray-100 rounded w-36 animate-pulse ml-auto"></div>
                </td>
              </tr>
            </tbody>
            <tbody v-else class="bg-white divide-y divide-gray-200">
              <template v-for="reference in filteredReferences" :key="reference.id">
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">{{ reference.property_address }}</div>
                    <div class="text-sm text-gray-500">
                      {{ reference.property_city }}{{ reference.property_postcode ? ', ' + reference.property_postcode :
                        '' }}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <button v-if="reference.is_group_parent" @click.stop="toggleExpanded(reference.id)"
                        class="text-gray-400 hover:text-gray-600 focus:outline-none">
                        <svg class="w-5 h-5 transition-transform"
                          :class="{ 'rotate-90': expandedReference === reference.id }" fill="currentColor"
                          viewBox="0 0 20 20">
                          <path fill-rule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clip-rule="evenodd" />
                        </svg>
                      </button>
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <div class="text-sm font-medium text-gray-900">
                            {{ reference.tenant_first_name }} {{ reference.tenant_last_name }}
                          </div>
                          <span v-if="reference.is_group_parent"
                            class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            {{ reference.tenant_count || 0 }} Tenants
                          </span>
                        </div>
                        <div class="text-sm text-gray-500">{{ reference.tenant_email }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="{
                      'bg-yellow-100 text-yellow-800': reference.status === 'pending',
                      'bg-blue-100 text-blue-800': reference.status === 'in_progress',
                      'bg-orange-100 text-orange-800': reference.status === 'pending_verification',
                      'bg-green-100 text-green-800': reference.status === 'completed',
                      'bg-red-100 text-red-800': reference.status === 'rejected',
                      'bg-gray-100 text-gray-800': reference.status === 'cancelled'
                    }">
                      {{ formatStatus(reference.status, reference) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap" style="width: 220px;">
                    <!-- Rejected: show clear rejection message -->
                    <div v-if="reference.status === 'rejected'" class="flex items-start gap-2 text-sm text-red-700">
                      <svg class="w-4 h-4 mt-0.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 9v4m0 4h.01M10.29 3.86L2.82 18a1 1 0 00.9 1.5h16.56a1 1 0 00.9-1.5L13.71 3.86a1 1 0 00-1.72 0z" />
                      </svg>
                      <span>
                        {{ findReason(reference?.final_remarks) }}
                      </span>
                    </div>

                    <!-- Completed: green verified pill -->
                    <div v-else-if="reference.status === 'completed'"
                      class="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-100">
                      <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Verified</span>
                    </div>

                    <!-- In progress / pending etc: subtle "in progress" with clock icon -->
                    <div v-else
                      class="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-100">
                      <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Awaiting outcome</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                      <!-- Employment Reference -->
                      <div class="flex items-center gap-1"
                        :title="reference.has_employer_reference ? 'Employment reference received' : 'Employment reference pending'">
                        <svg class="w-5 h-5"
                          :class="reference.has_employer_reference ? 'text-green-600' : 'text-gray-300'"
                          fill="currentColor" viewBox="0 0 20 20">
                          <path v-if="reference.has_employer_reference" fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clip-rule="evenodd" />
                          <path v-else fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 000 2h2a1 1 0 100-2H9z"
                            clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs text-gray-600">Emp</span>
                      </div>
                      <!-- Credit Check -->
                      <div class="flex items-center gap-1"
                        :title="(reference.has_credit_check && (reference.credit_check_status === 'passed' || reference.credit_check_status === 'refer')) ? 'Credit check completed' : (reference.credit_check_status === 'failed' || reference.credit_check_status === 'error') ? 'Credit check failed' : 'Credit check pending'">
                        <svg class="w-5 h-5"
                          :class="(reference.has_credit_check && (reference.credit_check_status === 'passed' || reference.credit_check_status === 'refer')) ? 'text-green-600' : (reference.credit_check_status === 'failed' || reference.credit_check_status === 'error') ? 'text-red-600' : 'text-gray-300'"
                          fill="currentColor" viewBox="0 0 20 20">
                          <path
                            v-if="reference.has_credit_check && (reference.credit_check_status === 'passed' || reference.credit_check_status === 'refer')"
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clip-rule="evenodd" />
                          <path v-else fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 000 2h2a1 1 0 100-2H9z"
                            clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs text-gray-600">Credit</span>
                      </div>
                      <!-- Residential Reference -->
                      <div class="flex items-center gap-1"
                        :title="reference.reference_type === 'living_with_family' ? 'Tenant is living with family, no residential reference required' : (reference.has_landlord_reference || reference.has_agent_reference) ? 'Residential reference received' : 'Residential reference pending'">
                        <svg class="w-5 h-5"
                          :class="(reference.reference_type === 'living_with_family' || reference.has_landlord_reference || reference.has_agent_reference) ? 'text-green-600' : 'text-gray-300'"
                          fill="currentColor" viewBox="0 0 20 20">
                          <path
                            v-if="(reference.has_landlord_reference || reference.has_agent_reference || reference.reference_type === 'living_with_family')"
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clip-rule="evenodd" />
                          <path v-else fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 000 2h2a1 1 0 100-2H9z"
                            clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs text-gray-600">Res</span>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ formatDate(reference.created_at) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {{ reference.move_in_date ? formatDate(reference.move_in_date) : '—' }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button @click="viewReference(reference)" class="text-primary hover:text-primary/80">
                      View
                    </button>
                    <button @click="createAgreement(reference)"
                      class="ml-3 text-green-600 hover:text-green-700 font-medium"
                      title="Create Agreement from this reference">
                      Create Agreement
                    </button>
                    <button @click="confirmDelete(reference)" class="ml-3 text-red-600 hover:text-red-700 font-medium"
                      title="Delete reference">
                      Delete
                    </button>
                  </td>
                </tr>
                <!-- Guarantor Row (if exists) -->
                <tr v-if="reference.guarantors && reference.guarantors.length > 0"
                  v-for="guarantor in reference.guarantors" :key="`guarantor-${guarantor.id}`"
                  class="bg-purple-50 border-l-4 border-l-purple-500">
                  <td class="px-6 py-3 pl-12">
                    <div class="text-xs text-purple-700 font-medium mb-1">↳ Guarantor for above tenant</div>
                    <div class="text-sm text-gray-900">{{ guarantor.property_address }}</div>
                  </td>
                  <td class="px-6 py-3">
                    <div class="flex items-center gap-2">
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <div class="text-sm font-medium text-gray-900">
                            {{ guarantor.tenant_first_name }} {{ guarantor.tenant_last_name }}
                          </div>
                          <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            Guarantor
                          </span>
                        </div>
                        <div class="text-sm text-gray-500">{{ guarantor.tenant_email }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-3">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full" :class="{
                      'bg-yellow-100 text-yellow-800': guarantor.status === 'pending',
                      'bg-blue-100 text-blue-800': guarantor.status === 'in_progress',
                      'bg-orange-100 text-orange-800': guarantor.status === 'pending_verification',
                      'bg-green-100 text-green-800': guarantor.status === 'completed',
                      'bg-red-100 text-red-800': guarantor.status === 'rejected',
                      'bg-gray-100 text-gray-800': guarantor.status === 'cancelled'
                    }">
                      {{ formatStatus(guarantor.status, guarantor) }}
                    </span>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap" style="width: 220px;">
                    <!-- Rejected guarantor: show clear rejection message -->
                    <div v-if="guarantor.status === 'rejected'" class="flex items-start gap-2 text-sm text-red-700">
                      <svg class="w-4 h-4 mt-0.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 9v4m0 4h.01M10.29 3.86L2.82 18a1 1 0 00.9 1.5h16.56a1 1 0 00.9-1.5L13.71 3.86a1 1 0 00-1.72 0z" />
                      </svg>
                      <span>
                        {{ guarantor.rejection_message || 'Reference rejected due to incomplete verification' }}
                      </span>
                    </div>

                    <!-- Completed guarantor: green verified pill -->
                    <div v-else-if="guarantor.status === 'completed'"
                      class="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-100">
                      <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Verified</span>
                    </div>

                    <!-- In progress / pending etc: subtle "in progress" with clock icon -->
                    <div v-else
                      class="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 border border-amber-100">
                      <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Awaiting outcome</span>
                    </div>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap">
                    <div class="flex items-center gap-3">
                      <!-- Employment Reference -->
                      <div class="flex items-center gap-1"
                        :title="guarantor.has_employer_reference ? 'Employment reference received' : 'Employment reference pending'">
                        <svg class="w-5 h-5"
                          :class="guarantor.has_employer_reference ? 'text-green-600' : 'text-gray-300'"
                          fill="currentColor" viewBox="0 0 20 20">
                          <path v-if="guarantor.has_employer_reference" fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clip-rule="evenodd" />
                          <path v-else fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 000 2h2a1 1 0 100-2H9z"
                            clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs text-gray-600">Emp</span>
                      </div>
                      <!-- Credit Check -->
                      <div class="flex items-center gap-1"
                        :title="guarantor.has_credit_check ? 'Credit check completed' : 'Credit check pending'">
                        <svg class="w-5 h-5" :class="guarantor.has_credit_check ? 'text-green-600' : 'text-gray-300'"
                          fill="currentColor" viewBox="0 0 20 20">
                          <path v-if="guarantor.has_credit_check" fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clip-rule="evenodd" />
                          <path v-else fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 000 2h2a1 1 0 100-2H9z"
                            clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs text-gray-600">Credit</span>
                      </div>
                      <!-- Residential Reference -->
                      <div class="flex items-center gap-1"
                        :title="(guarantor.has_landlord_reference || guarantor.has_agent_reference) ? 'Residential reference received' : 'Residential reference pending'">
                        <svg class="w-5 h-5"
                          :class="(guarantor.has_landlord_reference || guarantor.has_agent_reference) ? 'text-green-600' : 'text-gray-300'"
                          fill="currentColor" viewBox="0 0 20 20">
                          <path v-if="(guarantor.has_landlord_reference || guarantor.has_agent_reference)"
                            fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clip-rule="evenodd" />
                          <path v-else fill-rule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 000 2h2a1 1 0 100-2H9z"
                            clip-rule="evenodd" />
                        </svg>
                        <span class="text-xs text-gray-600">Res</span>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                    {{ formatDate(guarantor.created_at) }}
                  </td>
                  <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                    {{ guarantor.move_in_date ? formatDate(guarantor.move_in_date) : '—' }}
                  </td>
                  <td class="px-6 py-3 text-right text-sm font-medium">
                    <button @click="viewReference(guarantor)" class="text-purple-600 hover:text-purple-800 font-medium">
                      View
                    </button>
                    <button @click="confirmDelete(guarantor)" class="ml-3 text-red-600 hover:text-red-700 font-medium"
                      title="Delete guarantor reference">
                      Delete
                    </button>
                  </td>
                </tr>
                <!-- Expanded Tenant List -->
                <tr v-if="reference.is_group_parent && expandedReference === reference.id" class="bg-gray-50">
                  <td colspan="8" class="px-6 py-4">
                    <div class="ml-8">
                      <h4 class="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Individual Tenants
                      </h4>
                      <div v-if="reference.children" class="space-y-3">
                        <div v-for="(child, index) in reference.children" :key="child.id"
                          class="bg-white rounded-lg border border-gray-200">
                          <!-- Tenant Info -->
                          <div class="flex items-center justify-between p-3 hover:border-primary transition-colors">
                            <div class="flex-1">
                              <div class="flex items-center gap-2">
                                <span class="text-xs font-medium text-gray-500">Tenant {{ index + 1 }}</span>
                                <span class="px-2 py-0.5 text-xs font-semibold rounded-full" :class="{
                                  'bg-yellow-100 text-yellow-800': child.status === 'pending',
                                  'bg-blue-100 text-blue-800': child.status === 'in_progress',
                                  'bg-orange-100 text-orange-800': child.status === 'pending_verification',
                                  'bg-green-100 text-green-800': child.status === 'completed'
                                }">
                                  {{ formatStatus(child.status, child) }}
                                </span>
                              </div>
                              <p class="text-sm font-medium text-gray-900 mt-1">
                                {{ child.tenant_first_name }} {{ child.tenant_last_name }}
                              </p>
                              <p class="text-xs text-gray-600">{{ child.tenant_email }}</p>
                              <p class="text-xs text-gray-900 mt-1">
                                Rent Share: <span class="font-semibold text-primary">£{{ child.rent_share }}</span>
                              </p>
                            </div>
                            <div class="ml-4 flex gap-2">
                              <button @click="viewReference(child)"
                                class="px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90">
                                View
                              </button>
                              <button @click="confirmDelete(child)"
                                class="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
                                title="Delete tenant reference">
                                Delete
                              </button>
                            </div>
                          </div>

                          <!-- Guarantors for this tenant -->
                          <div v-if="child.guarantors && child.guarantors.length > 0"
                            class="px-3 pb-3 pt-0 border-t border-gray-100">
                            <div class="pl-4 space-y-2">
                              <p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Guarantor</p>
                              <div v-for="guarantor in child.guarantors" :key="guarantor.id"
                                class="flex items-center justify-between p-2 bg-purple-50 rounded border border-purple-200">
                                <div class="flex-1">
                                  <div class="flex items-center gap-2">
                                    <span class="text-xs font-medium text-purple-700">🛡️ Guarantor</span>
                                    <span class="px-2 py-0.5 text-xs font-semibold rounded-full" :class="{
                                      'bg-yellow-100 text-yellow-800': guarantor.status === 'pending',
                                      'bg-blue-100 text-blue-800': guarantor.status === 'in_progress',
                                      'bg-orange-100 text-orange-800': guarantor.status === 'pending_verification',
                                      'bg-green-100 text-green-800': guarantor.status === 'completed'
                                    }">
                                      {{ formatStatus(guarantor.status, guarantor) }}
                                    </span>
                                  </div>
                                  <p class="text-xs font-medium text-gray-900 mt-1">
                                    {{ guarantor.tenant_first_name }} {{ guarantor.tenant_last_name }}
                                  </p>
                                  <p class="text-xs text-gray-600">{{ guarantor.tenant_email }}</p>
                                </div>
                                <div class="ml-2 flex gap-2">
                                  <button @click="viewReference(guarantor)"
                                    class="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700">
                                    View
                                  </button>
                                  <button @click="confirmDelete(guarantor)"
                                    class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                    title="Delete guarantor reference">
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div v-else class="flex items-center justify-center py-4">
                        <div class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                        <span class="ml-2 text-sm text-gray-600">Loading tenants...</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="bg-white rounded-lg shadow p-6">
        <div class="text-center py-12">
          <svg v-if="!searchQuery" class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <svg v-else class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">
            {{ searchQuery ? 'No references found' : 'No references yet' }}
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            {{ searchQuery ? 'Try adjusting your search terms.' : 'Get started by creating a new tenant reference.' }}
          </p>
          <div v-if="!searchQuery" class="mt-6">
            <button @click="showCreateModal = true"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md">
              Create New Reference
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Reference Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div class="p-6 pb-4">
          <h3 class="text-lg font-semibold text-gray-900">Create New Reference</h3>
        </div>
        <form @submit.prevent="handleCreate" class="flex flex-col flex-1 min-h-0">
          <div class="px-6 overflow-y-auto flex-1 space-y-4">
            <!-- Tenant Count Selector -->
            <div>
              <label for="tenant-count" class="block text-sm font-medium text-gray-700 mb-2">Number of Tenants *</label>
              <select id="tenant-count" v-model.number="tenantCount" @change="updateTenantCount(tenantCount)"
                class="block w-1/3 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary">
                <option :value="1">1 Tenant</option>
                <option :value="2">2 Tenants</option>
                <option :value="3">3 Tenants</option>
                <option :value="4">4 Tenants</option>
                <option :value="5">5 Tenants</option>
                <option :value="6">6 Tenants</option>
                <option :value="7">7 Tenants</option>
                <option :value="8">8 Tenants</option>
                <option :value="9">9 Tenants</option>
                <option :value="10">10 Tenants</option>
                <option :value="11">11 Tenants</option>
                <option :value="12">12 Tenants</option>
                <option :value="13">13 Tenants</option>
                <option :value="14">14 Tenants</option>
                <option :value="15">15 Tenants</option>
              </select>
            </div>

            <!-- Property Information (shown once) -->
            <div>
              <h4 class="text-md font-semibold text-gray-700 mb-3">Property Information</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <AddressAutocomplete v-model="formData.property_address" label="Property Address" :required="true"
                    id="address" placeholder="Start typing address..."
                    @addressSelected="handlePropertyAddressSelected" />
                </div>
                <div>
                  <label for="city" class="block text-sm font-medium text-gray-700">City *</label>
                  <input id="city" v-model="formData.property_city" type="text" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label for="postcode" class="block text-sm font-medium text-gray-700">Postcode *</label>
                  <input id="postcode" v-model="formData.property_postcode" type="text" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label for="rent" class="block text-sm font-medium text-gray-700">Total Monthly Rent (£) *</label>
                  <input id="rent" v-model.number="formData.monthly_rent" type="number" step="1" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
              </div>
            </div>

            <!-- Single Tenant Information (v-if tenantCount === 1) -->
            <div v-if="tenantCount === 1">
              <h4 class="text-md font-semibold text-gray-700 mb-3">Tenant Information</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="first-name" class="block text-sm font-medium text-gray-700">First Name *</label>
                  <input id="first-name" v-model="formData.tenant_first_name" type="text" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label for="last-name" class="block text-sm font-medium text-gray-700">Last Name *</label>
                  <input id="last-name" v-model="formData.tenant_last_name" type="text" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-700">Email *</label>
                  <input id="email" v-model="formData.tenant_email" type="email" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <PhoneInput v-model="formData.tenant_phone" label="Phone" id="phone" :required="true" />
                </div>
              </div>

              <!-- Guarantor for single tenant -->
              <div class="mt-4 pt-4 border-t border-gray-200">
                <div class="flex items-center justify-between mb-3">
                  <h5 class="text-sm font-semibold text-gray-700">Add Guarantor (Optional)</h5>
                  <button type="button" @click="showGuarantorFields = !showGuarantorFields"
                    class="text-sm text-primary hover:underline">
                    {{ showGuarantorFields ? 'Hide' : 'Show' }}
                  </button>
                </div>

                <div v-if="showGuarantorFields" class="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p class="text-sm text-gray-600">Add guarantor details. They will receive an email to complete the
                    reference form.</p>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="guarantor-first-name" class="block text-sm font-medium text-gray-700">First
                        Name</label>
                      <input id="guarantor-first-name" v-model="formData.guarantor_first_name" type="text"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                    </div>
                    <div>
                      <label for="guarantor-last-name" class="block text-sm font-medium text-gray-700">Last Name</label>
                      <input id="guarantor-last-name" v-model="formData.guarantor_last_name" type="text"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                    </div>
                    <div>
                      <label for="guarantor-email" class="block text-sm font-medium text-gray-700">Email</label>
                      <input id="guarantor-email" v-model="formData.guarantor_email" type="email"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                    </div>
                    <div>
                      <PhoneInput v-model="formData.guarantor_phone" label="Phone" id="guarantor-phone"
                        :required="false" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Multiple Tenants (v-if tenantCount > 1) -->
            <div v-if="tenantCount > 1">
              <h4 class="text-md font-semibold text-gray-700 mb-3">Tenants</h4>
              <div v-for="(tenant, index) in tenants" :key="index"
                class="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h5 class="text-sm font-semibold text-gray-700 mb-3">Tenant {{ index + 1 }}</h5>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label :for="`tenant-${index}-first-name`" class="block text-sm font-medium text-gray-700">First
                      Name *</label>
                    <input :id="`tenant-${index}-first-name`" v-model="tenant.first_name" type="text" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                    <label :for="`tenant-${index}-last-name`" class="block text-sm font-medium text-gray-700">Last Name
                      *</label>
                    <input :id="`tenant-${index}-last-name`" v-model="tenant.last_name" type="text" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                    <label :for="`tenant-${index}-email`" class="block text-sm font-medium text-gray-700">Email
                      *</label>
                    <input :id="`tenant-${index}-email`" v-model="tenant.email" type="email" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                    <PhoneInput v-model="tenant.phone" :label="`Phone`" :id="`tenant-${index}-phone`"
                      :required="true" />
                  </div>
                  <div class="col-span-2">
                    <label :for="`tenant-${index}-rent-share`" class="block text-sm font-medium text-gray-700">Rent
                      Share (£) *</label>
                    <input :id="`tenant-${index}-rent-share`" v-model.number="tenant.rent_share" type="number"
                      step="0.01" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="0.00" />
                  </div>
                </div>

                <!-- Guarantor for this tenant -->
                <div class="mt-3 pt-3 border-t border-gray-300">
                  <div class="flex items-center justify-between mb-2">
                    <h6 class="text-sm font-medium text-gray-700">Add Guarantor (Optional)</h6>
                    <button type="button" @click="tenant.showGuarantorFields = !tenant.showGuarantorFields"
                      class="text-xs text-primary hover:underline">
                      {{ tenant.showGuarantorFields ? 'Hide' : 'Show' }}
                    </button>
                  </div>

                  <div v-if="tenant.showGuarantorFields"
                    class="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
                    <p class="text-xs text-gray-600">Add guarantor details for this tenant. They will receive an email
                      to complete the reference form.</p>

                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label :for="`tenant-${index}-guarantor-first-name`"
                          class="block text-xs font-medium text-gray-700">First Name</label>
                        <input :id="`tenant-${index}-guarantor-first-name`" :value="tenant.guarantor?.first_name || ''"
                          @input="(e: Event) => { const target = e.target as HTMLInputElement; if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.first_name = target.value }"
                          type="text"
                          class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                      <div>
                        <label :for="`tenant-${index}-guarantor-last-name`"
                          class="block text-xs font-medium text-gray-700">Last Name</label>
                        <input :id="`tenant-${index}-guarantor-last-name`" :value="tenant.guarantor?.last_name || ''"
                          @input="(e: Event) => { const target = e.target as HTMLInputElement; if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.last_name = target.value }"
                          type="text"
                          class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                      <div>
                        <label :for="`tenant-${index}-guarantor-email`"
                          class="block text-xs font-medium text-gray-700">Email</label>
                        <input :id="`tenant-${index}-guarantor-email`" :value="tenant.guarantor?.email || ''"
                          @input="(e: Event) => { const target = e.target as HTMLInputElement; if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.email = target.value }"
                          type="email"
                          class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                      <div>
                        <label :for="`tenant-${index}-guarantor-phone`"
                          class="block text-xs font-medium text-gray-700">Phone</label>
                        <PhoneInput :modelValue="tenant.guarantor?.phone || ''"
                          @update:modelValue="(val) => { if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.phone = val }"
                          :id="`tenant-${index}-guarantor-phone`" :required="false"
                          input-class="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                          select-class="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Rent Calculator -->
              <div class="p-4 rounded-lg"
                :class="rentSharesValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
                <div class="flex justify-between items-center">
                  <span class="text-sm font-medium" :class="rentSharesValid ? 'text-green-900' : 'text-red-900'">
                    Total Rent Shares:
                  </span>
                  <span class="text-lg font-bold" :class="rentSharesValid ? 'text-green-900' : 'text-red-900'">
                    £{{ totalRentShare.toFixed(2) }} / £{{ Number(formData.monthly_rent || 0).toFixed(2) }}
                  </span>
                </div>
                <p v-if="!rentSharesValid" class="text-xs text-red-700 mt-2">
                  Rent shares must sum exactly to the total monthly rent
                </p>
                <p v-else class="text-xs text-green-700 mt-2">
                  ✓ Rent shares match total rent
                </p>
              </div>
            </div>

            <!-- Move-in Date & Term Length Grid -->
            <div class="grid grid-cols-2 gap-6">
              <div>
                <DatePicker v-model="formData.move_in_date" label="Move-in Date" :required="true"
                  year-range-type="move-in" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Term Length</label>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex items-center gap-2">
                    <label for="term-years" class="text-sm text-gray-600 whitespace-nowrap">Years</label>
                    <input id="term-years" v-model.number="formData.term_years" type="number" min="0"
                      class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="0" />
                  </div>
                  <div class="flex items-center gap-2">
                    <label for="term-months" class="text-sm text-gray-600 whitespace-nowrap">Months</label>
                    <input id="term-months" v-model.number="formData.term_months" type="number" min="0" max="11"
                      class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="0" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label for="notes" class="block text-sm font-medium text-gray-700">Notes</label>
              <textarea id="notes" v-model="formData.notes" rows="2"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Optional notes about this reference..."></textarea>
            </div>

            <div v-if="createError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {{ createError }}
            </div>

            <div v-if="createSuccess" class="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
              {{ createSuccess }}
            </div>
          </div>

          <!-- Sticky Footer with Buttons -->
          <div class="p-6 pt-4 border-t border-gray-200 bg-white rounded-b-lg">
            <div class="flex justify-end space-x-3">
              <button type="button" @click="closeCreateModal"
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                Cancel
              </button>
              <button type="submit" :disabled="createLoading"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50">
                {{ createLoading ? 'Creating...' : 'Create Reference' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- Insufficient Credits Modal -->
    <InsufficientCreditsModal v-if="showInsufficientCreditsModal" @close="showInsufficientCreditsModal = false"
      @purchased="handleCreditsPurchased" />

    <!-- Payment Method Required Modal -->
    <PaymentMethodRequiredModal :show="showPaymentMethodModal" @close="showPaymentMethodModal = false" />

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-lg max-w-md w-full p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Delete Reference</h3>
        <p class="text-sm text-gray-600 mb-6">
          Are you sure you want to delete the reference for
          <span class="font-medium">{{ referenceToDelete?.tenant_first_name }} {{ referenceToDelete?.tenant_last_name
            }}</span>
          at <span class="font-medium">{{ referenceToDelete?.property_address }}</span>?
          This action cannot be undone.
        </p>
        <div class="flex justify-end space-x-3">
          <button @click="showDeleteModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Cancel
          </button>
          <button @click="handleDelete" :disabled="deleteLoading"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50">
            {{ deleteLoading ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import PhoneInput from '../components/PhoneInput.vue'
import DatePicker from '../components/DatePicker.vue'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'
import InsufficientCreditsModal from '../components/InsufficientCreditsModal.vue'
import PaymentMethodRequiredModal from '../components/PaymentMethodRequiredModal.vue'
import { formatDate as formatUkDate } from '../utils/date'
import { isValidEmail } from '../utils/validation'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const showCreateModal = ref(false)
const showGuarantorFields = ref(false)
const showInsufficientCreditsModal = ref(false)
const showPaymentMethodModal = ref(false)
const showDeleteModal = ref(false)
const referenceToDelete = ref<any>(null)
const deleteLoading = ref(false)
const references = ref<any[]>([])
const loading = ref(true)
const createLoading = ref(false)
const createError = ref('')
const createSuccess = ref('')
const expandedReference = ref<string | null>(null)
const searchQuery = ref('')
const statusFilter = ref('')
const dateFilter = ref('')
const sortBy = ref<'created_at' | 'move_in_date'>('created_at')
const sortOrder = ref<'asc' | 'desc'>('desc')

const tenantCount = ref(1)
const tenants = ref<Array<{
  first_name: string
  last_name: string
  email: string
  phone: string
  rent_share: number | null
  guarantor?: {
    first_name: string
    last_name: string
    email: string
    phone: string
  } | null
  showGuarantorFields?: boolean
}>>([{
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  rent_share: null,
  guarantor: null,
  showGuarantorFields: false
}])

const formData = ref({
  tenant_first_name: '',
  tenant_last_name: '',
  tenant_email: '',
  tenant_phone: '',
  property_address: '',
  property_city: '',
  property_postcode: '',
  monthly_rent: null,
  move_in_date: '',
  term_years: 0,
  term_months: 0,
  notes: '',
  guarantor_first_name: '',
  guarantor_last_name: '',
  guarantor_email: '',
  guarantor_phone: ''
})

const totalRentShare = computed(() => {
  return tenants.value.reduce((sum, t) => sum + (Number(t.rent_share) || 0), 0)
})

const rentSharesValid = computed(() => {
  if (tenantCount.value === 1) return true
  const total = totalRentShare.value
  const monthlyRent = Number(formData.value.monthly_rent) || 0
  return Math.abs(total - monthlyRent) < 0.01 && monthlyRent > 0
})

const statusCounts = computed(() => {
  const counts = {
    pending: 0,
    in_progress: 0,
    pending_verification: 0,
    rejected: 0,
    completed: 0,
    cancelled: 0
  }

  references.value.forEach(ref => {
    if (counts.hasOwnProperty(ref.status)) {
      counts[ref.status as keyof typeof counts]++
    }
  })

  return counts
})

const filteredReferences = computed(() => {
  // Filter out guarantor references - they should only appear nested under their parent
  let filtered = references.value.filter(ref => !ref.is_guarantor)

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(ref => {
      const tenantName = `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.toLowerCase()
      const tenantEmail = (ref.tenant_email || '').toLowerCase()
      const propertyAddress = (ref.property_address || '').toLowerCase()
      const propertyCity = (ref.property_city || '').toLowerCase()
      const propertyPostcode = (ref.property_postcode || '').toLowerCase()

      return tenantName.includes(query) ||
        tenantEmail.includes(query) ||
        propertyAddress.includes(query) ||
        propertyCity.includes(query) ||
        propertyPostcode.includes(query)
    })
  }

  // Apply status filter
  if (statusFilter.value) {
    filtered = filtered.filter(ref => ref.status === statusFilter.value)
  }

  // Apply date filter
  if (dateFilter.value) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    filtered = filtered.filter(ref => {
      const createdDate = new Date(ref.created_at)
      const daysDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))

      switch (dateFilter.value) {
        case 'today':
          return createdDate >= today
        case 'week':
          return daysDiff <= 7
        case 'month':
          return daysDiff <= 30
        case 'quarter':
          return daysDiff <= 90
        case 'year':
          return daysDiff <= 365
        default:
          return true
      }
    })
  }

  // Sort references
  const sorted = [...filtered].sort((a, b) => {
    let aValue: any
    let bValue: any

    if (sortBy.value === 'move_in_date') {
      aValue = a.move_in_date ? new Date(a.move_in_date).getTime() : 0
      bValue = b.move_in_date ? new Date(b.move_in_date).getTime() : 0
    } else {
      // Default: sort by created_at
      aValue = a.created_at ? new Date(a.created_at).getTime() : 0
      bValue = b.created_at ? new Date(b.created_at).getTime() : 0
    }

    if (sortOrder.value === 'asc') {
      return aValue - bValue
    } else {
      return bValue - aValue
    }
  })
  return sorted
})

const updateTenantCount = (count: number) => {
  tenantCount.value = count
  // Adjust tenants array
  while (tenants.value.length < count) {
    tenants.value.push({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      rent_share: null,
      guarantor: null,
      showGuarantorFields: false
    })
  }
  while (tenants.value.length > count) {
    tenants.value.pop()
  }
}

// Handler for custom event from sidebar
const handleOpenCreateModal = () => {
  showCreateModal.value = true
}

onMounted(() => {
  fetchReferences()

  // Check if we should open the create modal
  if (route.query.create === 'true') {
    showCreateModal.value = true
    // Remove the query parameter from the URL
    router.replace('/references')
  }

  // Check if we should apply a status filter from query params
  if (route.query.status && typeof route.query.status === 'string') {
    statusFilter.value = route.query.status
  }

  // Listen for custom event from sidebar
  window.addEventListener('open-create-reference-modal', handleOpenCreateModal)
})

onUnmounted(() => {
  // Clean up event listener
  window.removeEventListener('open-create-reference-modal', handleOpenCreateModal)
})

const fetchReferences = async () => {
  try {
    loading.value = true
    const token = authStore.session?.access_token
    if (!token) {
      console.error('No auth token available')
      return
    }

    const response = await fetch(`${API_URL}/api/references`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.status === 404) {
      // User no longer has access to company (likely removed from team)
      console.log('User no longer has access, logging out...')
      await authStore.signOut()
      router.push('/login')
      return
    }

    if (!response.ok) {
      throw new Error('Failed to fetch references')
    }

    const data = await response.json()
    const allReferences = data.references

    // Attach guarantors to their parent references
    const guarantorMap = new Map()
    allReferences.forEach((ref: any) => {
      if (ref.is_guarantor && ref.guarantor_for_reference_id) {
        if (!guarantorMap.has(ref.guarantor_for_reference_id)) {
          guarantorMap.set(ref.guarantor_for_reference_id, [])
        }
        guarantorMap.get(ref.guarantor_for_reference_id).push(ref)
      }
    })

    // Attach guarantors array to parent references
    allReferences.forEach((ref: any) => {
      if (guarantorMap.has(ref.id)) {
        ref.guarantors = guarantorMap.get(ref.id)
      } else {
        ref.guarantors = []
      }
    })

    references.value = allReferences
  } catch (error) {
    console.error('Failed to fetch references:', error)
  } finally {
    loading.value = false
  }
}

const handleCreate = async () => {
  createLoading.value = true
  createError.value = ''
  createSuccess.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      createError.value = 'No auth token available'
      return
    }

    let payload: any

    // Validate move-in date is provided
    if (!formData.value.move_in_date) {
      createError.value = 'Move-in date is required'
      createLoading.value = false
      return
    }

    // Validate email addresses
    if (tenantCount.value === 1) {
      if (!isValidEmail(formData.value.tenant_email)) {
        createError.value = 'Please enter a valid tenant email address'
        createLoading.value = false
        return
      }
      if (formData.value.guarantor_email && !isValidEmail(formData.value.guarantor_email)) {
        createError.value = 'Please enter a valid guarantor email address'
        createLoading.value = false
        return
      }
    } else {
      // Validate all tenant emails
      for (let i = 0; i < tenants.value.length; i++) {
        const tenant = tenants.value[i];
        if (!isValidEmail(tenant?.email || '')) {
          createError.value = `Please enter a valid email address for tenant ${i + 1}`
          createLoading.value = false
          return
        }
        if (tenant?.guarantor?.email && !isValidEmail(tenant.guarantor.email)) {
          createError.value = `Please enter a valid email address for guarantor of tenant ${i + 1}`
          createLoading.value = false
          return
        }
      }
    }

    if (tenantCount.value === 1) {
      // Single tenant flow
      payload = {
        ...formData.value
      }
    } else {
      // Multi-tenant flow
      if (!rentSharesValid.value) {
        createError.value = 'Rent shares must sum to the total monthly rent'
        createLoading.value = false
        return
      }

      payload = {
        tenants: tenants.value,
        property_address: formData.value.property_address,
        property_city: formData.value.property_city,
        property_postcode: formData.value.property_postcode,
        monthly_rent: formData.value.monthly_rent,
        move_in_date: formData.value.move_in_date,
        term_years: formData.value.term_years,
        term_months: formData.value.term_months,
        notes: formData.value.notes
      }
    }

    const response = await fetch(`${API_URL}/api/references`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      // Check for 402 Payment Required (could be credits OR payment method)
      if (response.status === 402) {
        const errorData = await response.json()
        closeCreateModal()

        // Check if it's a payment method issue or credits issue
        if (errorData.requires_payment_method || errorData.error === 'Payment Method Required') {
          // Payment method required - show modal
          showPaymentMethodModal.value = true
        } else {
          // Insufficient credits
          showInsufficientCreditsModal.value = true
        }
        return
      }

      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create reference')
    }

    await response.json()
    createSuccess.value = tenantCount.value > 1
      ? `Reference created successfully for ${tenantCount.value} tenants!`
      : 'Reference created successfully!'

    setTimeout(() => {
      closeCreateModal()
      fetchReferences()
    }, 2000)
  } catch (error: any) {
    createError.value = error.message || 'Failed to create reference'
  } finally {
    createLoading.value = false
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  tenantCount.value = 1
  tenants.value = [{
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    rent_share: null,
    guarantor: null,
    showGuarantorFields: false
  }]
  formData.value = {
    tenant_first_name: '',
    tenant_last_name: '',
    tenant_email: '',
    tenant_phone: '',
    property_address: '',
    property_city: '',
    property_postcode: '',
    monthly_rent: null,
    move_in_date: '',
    term_years: 0,
    term_months: 0,
    notes: '',
    guarantor_first_name: '',
    guarantor_last_name: '',
    guarantor_email: '',
    guarantor_phone: ''
  }
  showGuarantorFields.value = false
  createError.value = ''
  createSuccess.value = ''
}

const clearFilters = () => {
  statusFilter.value = ''
  dateFilter.value = ''
}

const formatStatus = (status: string, reference?: any) => {
  // If status is 'in_progress' or 'pending_verification', provide more detail about what's missing
  if ((status === 'in_progress' || status === 'pending_verification') && reference) {
    const missing: string[] = []

    // Check for residential reference (landlord or agent)
    // Skip if tenant is a homeowner or is a guarantor (guarantors don't need residential refs)
    const needsResidential =
      !reference.is_guarantor &&
      reference.reference_type !== 'living_with_family' &&
      reference.home_ownership_status !== 'homeowner' &&
      reference.home_ownership_status !== 'living_with_family'
    if (needsResidential && !reference.has_landlord_reference && !reference.has_agent_reference) {
      missing.push('Residential')
    }

    // Check for employment reference (employer)
    // Only needed if income source is employment (not self-employed)
    if (reference.income_employment && !reference.income_self_employed && !reference.has_employer_reference) {
      missing.push('Employment')
    }

    // Check for accountant reference
    // Only needed if income source is self-employed
    if (reference.income_self_employed && !reference.has_accountant_reference) {
      missing.push('Accountant')
    }

    // Check for guarantor reference
    // Only needed if tenant requires a guarantor and guarantor hasn't completed their reference
    if (reference.requires_guarantor && !reference.has_guarantor_reference) {
      missing.push('Guarantor')
    }

    // If references are missing, show "Awaiting X" status
    if (missing.length > 0) {
      // Build the "Awaiting X" string with proper grammar
      if (missing.length === 1) {
        return `Awaiting ${missing[0]}`
      } else if (missing.length === 2) {
        return `Awaiting ${missing[0]} & ${missing[1]}`
      } else {
        // 3 or more items: "Awaiting X, Y & Z"
        const lastItem = missing[missing.length - 1]
        const otherItems = missing.slice(0, -1).join(', ')
        return `Awaiting ${otherItems} & ${lastItem}`
      }
    }

    // If no references are missing and status is 'pending_verification', show proper status
    if (status === 'pending_verification' && missing.length === 0) {
      return 'Pending Verification'
    }
  }

  // Default: format the status string nicely
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const toggleSort = (field: 'created_at' | 'move_in_date') => {
  if (sortBy.value === field) {
    // Toggle order if same field
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Set new field and default to desc
    sortBy.value = field
    sortOrder.value = 'desc'
  }
}

const formatDate = (date?: string | null, fallback = 'N/A') =>
  formatUkDate(
    date,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    },
    fallback
  )

const viewReference = (reference: any) => {
  router.push(`/references/${reference.id}`)
}

const createAgreement = (reference: any) => {
  router.push({
    path: '/agreements/generate',
    query: { referenceId: reference.id }
  })
}

const toggleExpanded = async (referenceId: string) => {
  if (expandedReference.value === referenceId) {
    expandedReference.value = null
  } else {
    expandedReference.value = referenceId
    // Fetch children if not already loaded
    const reference = references.value.find(r => r.id === referenceId)
    if (reference && reference.is_group_parent && !reference.children) {
      await fetchChildren(referenceId)
    }
  }
}

const fetchChildren = async (parentId: string) => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await fetch(`${API_URL}/api/references/${parentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      const reference = references.value.find(r => r.id === parentId)
      if (reference && data.childReferences) {
        reference.children = data.childReferences
      }
    }
  } catch (error) {
    console.error('Failed to fetch children:', error)
  }
}

const handlePropertyAddressSelected = (addressData: any) => {
  console.log('Property address selected:', addressData)
  formData.value.property_address = addressData.addressLine1
  formData.value.property_city = addressData.city
  formData.value.property_postcode = addressData.postcode
}

const handleCreditsPurchased = () => {
  showInsufficientCreditsModal.value = false
  // Re-open the create modal so user can try again
  showCreateModal.value = true
}

const confirmDelete = (reference: any) => {
  referenceToDelete.value = reference
  showDeleteModal.value = true
}

const handleDelete = async () => {
  if (!referenceToDelete.value) return

  deleteLoading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) {
      console.error('No auth token available')
      return
    }

    const response = await fetch(`${API_URL}/api/references/${referenceToDelete.value.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to delete reference')
    }

    // Close modal and refresh list
    showDeleteModal.value = false
    referenceToDelete.value = null
    await fetchReferences()
  } catch (error: any) {
    console.error('Failed to delete reference:', error)
    alert(error.message || 'Failed to delete reference')
  } finally {
    deleteLoading.value = false
  }
}

//Fins rejected reason srring
const findReason = (remark_obj: Record<string, any>) => {
  return (remark_obj?.credit_tas?.tas_reason || remark_obj?.credit_tas?.notes || remark_obj?.id?.notes || remark_obj?.income?.notes || remark_obj?.residential?.notes || remark_obj?.rtr?.notes || "No reason mentioned during assessment!")
}
</script>

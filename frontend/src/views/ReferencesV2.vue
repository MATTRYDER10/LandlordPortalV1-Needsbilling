<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <!-- Header -->
      <div class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">References</h1>
              <span class="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full">V2</span>
            </div>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Section-based verification system</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="refreshData"
              :disabled="loading"
              class="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <RefreshCcw :class="{ 'animate-spin': loading }" class="w-4 h-4" />
            </button>
            <button
              @click="openCreateModal"
              class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all"
            >
              <Plus class="w-4 h-4" />
              New Reference
            </button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="mt-4 flex gap-3">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name, email, property..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
        </div>

        <!-- Status Tabs -->
        <div class="mt-4 flex gap-2 overflow-x-auto">
          <button
            v-for="tab in statusTabs"
            :key="tab.value"
            @click="activeStatus = tab.value"
            class="px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors"
            :class="activeStatus === tab.value
              ? 'bg-primary text-white'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'"
          >
            {{ tab.label }}
            <span v-if="tab.count !== undefined" class="ml-1.5 px-1.5 py-0.5 text-xs rounded-full"
              :class="activeStatus === tab.value ? 'bg-white/20' : 'bg-gray-200 dark:bg-slate-700'">
              {{ tab.count }}
            </span>
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <!-- Loading -->
        <div v-if="loading" class="space-y-4">
          <div v-for="i in 5" :key="i" class="bg-white dark:bg-slate-900 rounded-lg p-4 animate-pulse">
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
            <div class="h-3 bg-gray-100 dark:bg-slate-800 rounded w-1/2"></div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredReferences.length === 0" class="text-center py-12">
          <div class="w-16 h-16 mx-auto bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-2xl flex items-center justify-center mb-4">
            <FileText class="w-8 h-8 text-primary" />
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">No references found</h3>
          <p class="text-gray-500 dark:text-slate-400 mt-1 mb-4">
            {{ searchQuery ? 'Try adjusting your search' : 'Create a new reference to get started' }}
          </p>
          <button
            v-if="!searchQuery"
            @click="openCreateModal"
            class="px-4 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all"
          >
            Create New Reference
          </button>
        </div>

        <!-- Reference List -->
        <div v-else class="space-y-3">
          <div
            v-for="ref in filteredReferences"
            :key="ref.id"
            @click="openDrawer(ref)"
            class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 cursor-pointer hover:border-primary hover:shadow-md transition-all flex items-stretch"
          >
            <!-- Left side: Info -->
            <div class="p-4 min-w-0 max-w-md">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900 dark:text-white truncate">
                  {{ ref.tenant_first_name }} {{ ref.tenant_last_name }}
                </h3>
                <span
                  v-if="ref.requires_action"
                  class="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full shrink-0"
                >
                  Action Required
                </span>
              </div>
              <p class="text-sm text-primary mt-1 truncate">
                {{ ref.property_address }}, {{ ref.property_city }}
              </p>
              <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Created {{ formatDate(ref.created_at) }}
              </p>
              <div class="mt-2 flex items-center gap-3">
                <span
                  class="px-2 py-0.5 text-xs font-medium rounded-full"
                  :class="getStatusClass(ref.status)"
                >
                  {{ formatStatus(ref.status) }}
                </span>
                <span class="text-xs text-gray-400">
                  £{{ ref.monthly_rent }}/month
                </span>
              </div>
            </div>

            <!-- Section Status Blocks -->
            <div class="flex items-stretch ml-auto">
              <div
                v-for="section in getSortedSections(ref.sections)"
                :key="section.section_type"
                class="w-[72px] flex items-center justify-center text-xs font-semibold border-l border-gray-200 dark:border-slate-700"
                :class="getSectionBlockClass(section)"
              >
                {{ getSectionLabel(section.section_type) }}
              </div>
              <div class="w-10 flex items-center justify-center border-l border-gray-200 dark:border-slate-700">
                <ChevronRight class="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Reference Drawer -->
      <ReferenceDrawerV2
        v-if="selectedReference"
        :reference="selectedReference"
        :open="drawerOpen"
        @close="drawerOpen = false"
        @updated="refreshData"
      />

      <!-- Create Reference Modal -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <!-- Modal Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xl font-bold text-gray-900 dark:text-white">Create New Reference</h2>
                  <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Step {{ createStep }} of 3</p>
                </div>
                <button
                  @click="closeCreateModal"
                  class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Progress Bar -->
              <div class="mt-4 flex gap-2">
                <div
                  v-for="step in 3"
                  :key="step"
                  class="flex-1 h-1.5 rounded-full transition-colors"
                  :class="step <= createStep ? 'bg-primary' : 'bg-gray-200 dark:bg-slate-700'"
                />
              </div>
            </div>

            <!-- Modal Content -->
            <div class="flex-1 overflow-y-auto p-6">
              <!-- Step 1: Property Details -->
              <div v-if="createStep === 1" class="space-y-4">
                <div class="flex items-center gap-3 mb-6">
                  <div class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Home class="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-white">Property Details</h3>
                    <p class="text-sm text-gray-500">Search for an existing property or add a new one</p>
                  </div>
                </div>

                <!-- Property Search Section -->
                <div v-if="!isManualEntry && !selectedProperty" class="space-y-4">
                  <div class="relative">
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      <Building2 class="w-4 h-4 inline mr-1" />
                      Search Your Properties
                    </label>
                    <div class="relative">
                      <input
                        v-model="propertySearchQuery"
                        @input="searchPropertiesDebounced(propertySearchQuery)"
                        @focus="showPropertyDropdown = propertySearchResults.length > 0"
                        type="text"
                        placeholder="Type address, postcode, or city to search..."
                        class="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Loader2 v-if="searchingProperties" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                    </div>

                    <!-- Search Results Dropdown -->
                    <div
                      v-if="showPropertyDropdown && propertySearchResults.length > 0"
                      class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    >
                      <button
                        v-for="prop in propertySearchResults"
                        :key="prop.id"
                        @click="selectProperty(prop)"
                        type="button"
                        class="w-full px-4 py-3 text-left hover:bg-primary/5 border-b border-gray-100 dark:border-slate-700 last:border-0 transition-colors"
                      >
                        <p class="font-medium text-gray-900 dark:text-white">{{ prop.address_line1 }}</p>
                        <p class="text-sm text-gray-500">{{ prop.city }}, {{ prop.postcode }}</p>
                      </button>
                    </div>

                    <!-- No Results -->
                    <div
                      v-if="showPropertyDropdown && propertySearchQuery.length >= 2 && propertySearchResults.length === 0 && !searchingProperties"
                      class="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg p-4"
                    >
                      <p class="text-gray-500 dark:text-slate-400 text-sm mb-3">No properties found matching "{{ propertySearchQuery }}"</p>
                      <button
                        @click="switchToManualEntry"
                        type="button"
                        class="w-full px-4 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                      >
                        + Add New Property
                      </button>
                    </div>
                  </div>

                  <!-- Divider with "or" -->
                  <div class="relative flex items-center justify-center py-2">
                    <div class="absolute inset-0 flex items-center">
                      <div class="w-full border-t border-gray-200 dark:border-slate-700"></div>
                    </div>
                    <div class="relative px-4 bg-white dark:bg-slate-900 text-sm text-gray-500">or</div>
                  </div>

                  <!-- Manual Entry Button -->
                  <button
                    @click="switchToManualEntry"
                    type="button"
                    class="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-300 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus class="w-4 h-4" />
                    Enter Property Details Manually
                  </button>
                </div>

                <!-- Selected Property Display -->
                <div v-if="selectedProperty" class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <div class="flex items-start justify-between">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 class="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p class="font-medium text-green-800 dark:text-green-300">{{ selectedProperty.address_line1 }}</p>
                        <p class="text-sm text-green-600 dark:text-green-400">{{ selectedProperty.city }}, {{ selectedProperty.postcode }}</p>
                        <p class="text-xs text-green-500 mt-1">Property linked successfully</p>
                      </div>
                    </div>
                    <button
                      @click="clearPropertySelection"
                      type="button"
                      class="p-1 text-green-600 hover:text-green-800 dark:text-green-400"
                    >
                      <X class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- Manual Entry Form -->
                <div v-if="isManualEntry" class="space-y-4">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-700 dark:text-slate-300">New Property Details</span>
                    <button
                      @click="clearPropertySelection"
                      type="button"
                      class="text-sm text-primary hover:underline"
                    >
                      ← Back to Search
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2">
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Property Address *</label>
                      <input
                        v-model="createForm.property_address"
                        type="text"
                        required
                        placeholder="123 Example Street"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">City *</label>
                      <input
                        v-model="createForm.property_city"
                        type="text"
                        required
                        placeholder="London"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Postcode *</label>
                      <input
                        v-model="createForm.property_postcode"
                        type="text"
                        required
                        placeholder="SW1A 1AA"
                        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 flex items-center gap-1">
                    <AlertCircle class="w-3 h-3" />
                    A new property record will be created automatically
                  </p>
                </div>

                <!-- Rent and Move-in Date (Always visible) -->
                <div v-if="selectedProperty || isManualEntry" class="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Monthly Rent (£) *</label>
                    <input
                      v-model.number="createForm.monthly_rent"
                      type="number"
                      required
                      placeholder="1200"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Move-in Date</label>
                    <input
                      v-model="createForm.move_in_date"
                      type="date"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <!-- Step 2: Tenant Details -->
              <div v-if="createStep === 2" class="space-y-4">
                <div class="flex items-center justify-between mb-6">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                      <User class="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 class="font-semibold text-gray-900 dark:text-white">Tenant Details</h3>
                      <p class="text-sm text-gray-500">Who is this reference for?</p>
                    </div>
                  </div>
                  <select
                    v-model.number="tenantCount"
                    @change="updateTenantCount"
                    class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option v-for="n in 10" :key="n" :value="n">{{ n }} Tenant{{ n > 1 ? 's' : '' }}</option>
                  </select>
                </div>

                <!-- Single Tenant -->
                <div v-if="tenantCount === 1" class="space-y-4">
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">First Name *</label>
                      <input
                        v-model="createForm.tenant_first_name"
                        type="text"
                        required
                        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Last Name *</label>
                      <input
                        v-model="createForm.tenant_last_name"
                        type="text"
                        required
                        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email *</label>
                      <input
                        v-model="createForm.tenant_email"
                        type="email"
                        required
                        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone *</label>
                      <input
                        v-model="createForm.tenant_phone"
                        type="tel"
                        required
                        class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <!-- Multiple Tenants -->
                <div v-else class="space-y-4">
                  <div
                    v-for="(tenant, index) in tenants"
                    :key="index"
                    class="p-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-800"
                  >
                    <div class="flex items-center justify-between mb-3">
                      <span class="font-medium text-gray-900 dark:text-white">Tenant {{ index + 1 }}</span>
                      <span class="text-sm text-gray-500">Rent share: £{{ tenant.rent_share || 0 }}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">First Name *</label>
                        <input
                          v-model="tenant.first_name"
                          type="text"
                          required
                          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Last Name *</label>
                        <input
                          v-model="tenant.last_name"
                          type="text"
                          required
                          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Email *</label>
                        <input
                          v-model="tenant.email"
                          type="email"
                          required
                          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Phone *</label>
                        <input
                          v-model="tenant.phone"
                          type="tel"
                          required
                          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div class="col-span-2">
                        <label class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Rent Share (£) *</label>
                        <input
                          v-model.number="tenant.rent_share"
                          type="number"
                          required
                          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 3: Review -->
              <div v-if="createStep === 3" class="space-y-6">
                <div class="flex items-center gap-3 mb-6">
                  <div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                    <CheckCircle class="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 dark:text-white">Review & Send</h3>
                    <p class="text-sm text-gray-500">Confirm the details before sending</p>
                  </div>
                </div>

                <!-- Property Summary -->
                <div class="p-4 border border-gray-200 dark:border-slate-700 rounded-xl">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                      <Home class="w-4 h-4 text-gray-400" />
                      <span class="font-medium text-gray-900 dark:text-white">Property</span>
                    </div>
                    <span v-if="selectedProperty" class="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                      Linked
                    </span>
                    <span v-else class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                      New Property
                    </span>
                  </div>
                  <p class="text-gray-700 dark:text-slate-300">{{ createForm.property_address }}</p>
                  <p class="text-sm text-gray-500">{{ createForm.property_city }}, {{ createForm.property_postcode }}</p>
                  <p class="text-sm text-primary font-medium mt-2">£{{ createForm.monthly_rent }}/month</p>
                </div>

                <!-- Tenant Summary -->
                <div class="p-4 border border-gray-200 dark:border-slate-700 rounded-xl">
                  <div class="flex items-center gap-2 mb-3">
                    <User class="w-4 h-4 text-gray-400" />
                    <span class="font-medium text-gray-900 dark:text-white">{{ tenantCount === 1 ? 'Tenant' : `${tenantCount} Tenants` }}</span>
                  </div>

                  <div v-if="tenantCount === 1">
                    <p class="text-gray-700 dark:text-slate-300">{{ createForm.tenant_first_name }} {{ createForm.tenant_last_name }}</p>
                    <p class="text-sm text-gray-500">{{ createForm.tenant_email }}</p>
                  </div>
                  <div v-else class="space-y-2">
                    <div v-for="(tenant, index) in tenants" :key="index" class="flex justify-between text-sm">
                      <span class="text-gray-700 dark:text-slate-300">{{ tenant.first_name }} {{ tenant.last_name }}</span>
                      <span class="text-gray-500">£{{ tenant.rent_share }}/month</span>
                    </div>
                  </div>
                </div>

                <!-- Info Box -->
                <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                  <div class="flex gap-3">
                    <Mail class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p class="text-sm text-blue-800 dark:text-blue-300 font-medium">What happens next?</p>
                      <p class="text-sm text-blue-700 dark:text-blue-400 mt-1">
                        The tenant{{ tenantCount > 1 ? 's' : '' }} will receive an email with a link to complete their reference form. You'll be notified as each section is completed and ready for review.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-between">
              <button
                v-if="createStep > 1"
                @click="createStep--"
                class="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Back
              </button>
              <div v-else></div>

              <div class="flex gap-3">
                <button
                  @click="closeCreateModal"
                  class="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  v-if="createStep < 3"
                  @click="nextStep"
                  :disabled="!canProceed"
                  class="px-6 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
                <button
                  v-else
                  @click="submitReference"
                  :disabled="submitting"
                  class="px-6 py-2 bg-gradient-to-r from-primary to-orange-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {{ submitting ? 'Creating...' : 'Create & Send' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import Sidebar from '@/components/Sidebar.vue'
import ReferenceDrawerV2 from '@/components/ReferenceDrawerV2.vue'
import {
  Search,
  Plus,
  RefreshCcw,
  FileText,
  ChevronRight,
  Check,
  Clock,
  AlertCircle,
  XCircle,
  X,
  Home,
  User,
  CheckCircle,
  Mail,
  Building2,
  Loader2
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const authStore = useAuthStore()

const loading = ref(false)
const searchQuery = ref('')
const activeStatus = ref('all')
const references = ref<any[]>([])
const selectedReference = ref<any>(null)
const drawerOpen = ref(false)

// Create Modal State
const showCreateModal = ref(false)
const createStep = ref(1)
const submitting = ref(false)
const tenantCount = ref(1)

interface TenantForm {
  first_name: string
  last_name: string
  email: string
  phone: string
  rent_share: number
}

const createForm = ref({
  property_address: '',
  property_city: '',
  property_postcode: '',
  monthly_rent: null as number | null,
  move_in_date: '',
  tenant_first_name: '',
  tenant_last_name: '',
  tenant_email: '',
  tenant_phone: '',
  linked_property_id: null as string | null
})

const tenants = ref<TenantForm[]>([])

// Property search state
interface PropertySearchResult {
  id: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postcode: string
  formatted_address: string
}

const propertySearchQuery = ref('')
const propertySearchResults = ref<PropertySearchResult[]>([])
const searchingProperties = ref(false)
const showPropertyDropdown = ref(false)
const selectedProperty = ref<PropertySearchResult | null>(null)
const isManualEntry = ref(false)
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Property search functions
async function searchPropertiesDebounced(query: string) {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }

  if (!query || query.length < 2) {
    propertySearchResults.value = []
    showPropertyDropdown.value = false
    return
  }

  searchDebounceTimer = setTimeout(async () => {
    await searchProperties(query)
  }, 300)
}

async function searchProperties(query: string) {
  searchingProperties.value = true
  try {
    const response = await fetch(`${API_URL}/api/properties/search?q=${encodeURIComponent(query)}&limit=10`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })

    if (response.ok) {
      const data = await response.json()
      propertySearchResults.value = data.properties || []
      showPropertyDropdown.value = true
    }
  } catch (error) {
    console.error('Error searching properties:', error)
    propertySearchResults.value = []
  } finally {
    searchingProperties.value = false
  }
}

function selectProperty(property: PropertySearchResult) {
  selectedProperty.value = property
  createForm.value.property_address = property.address_line1 || ''
  createForm.value.property_city = property.city || ''
  createForm.value.property_postcode = property.postcode || ''
  createForm.value.linked_property_id = property.id
  propertySearchQuery.value = property.formatted_address
  showPropertyDropdown.value = false
  isManualEntry.value = false
}

function switchToManualEntry() {
  isManualEntry.value = true
  selectedProperty.value = null
  createForm.value.linked_property_id = null
  propertySearchQuery.value = ''
  showPropertyDropdown.value = false
}

function clearPropertySelection() {
  selectedProperty.value = null
  createForm.value.property_address = ''
  createForm.value.property_city = ''
  createForm.value.property_postcode = ''
  createForm.value.linked_property_id = null
  propertySearchQuery.value = ''
  isManualEntry.value = false
}

const statusTabs = computed(() => [
  { label: 'All', value: 'all', count: references.value.length },
  { label: 'Sent', value: 'SENT', count: references.value.filter(r => r.status === 'SENT').length },
  { label: 'Collecting', value: 'COLLECTING_EVIDENCE', count: references.value.filter(r => r.status === 'COLLECTING_EVIDENCE').length },
  { label: 'In Review', value: 'IN_REVIEW', count: references.value.filter(r => r.status === 'IN_REVIEW' || r.status === 'READY_FOR_REVIEW').length },
  { label: 'Completed', value: 'COMPLETED', count: references.value.filter(r => ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED'].includes(r.status)).length }
])

const filteredReferences = computed(() => {
  let result = references.value

  if (activeStatus.value !== 'all') {
    if (activeStatus.value === 'COMPLETED') {
      result = result.filter(r => ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED'].includes(r.status))
    } else if (activeStatus.value === 'IN_REVIEW') {
      result = result.filter(r => r.status === 'IN_REVIEW' || r.status === 'READY_FOR_REVIEW')
    } else {
      result = result.filter(r => r.status === activeStatus.value)
    }
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(r =>
      r.tenant_first_name?.toLowerCase().includes(query) ||
      r.tenant_last_name?.toLowerCase().includes(query) ||
      r.tenant_email?.toLowerCase().includes(query) ||
      r.property_address?.toLowerCase().includes(query) ||
      r.property_city?.toLowerCase().includes(query)
    )
  }

  return result
})

const canProceed = computed(() => {
  if (createStep.value === 1) {
    // Either a property is selected OR manual entry is complete
    const hasProperty = selectedProperty.value !== null || (
      isManualEntry.value &&
      createForm.value.property_address &&
      createForm.value.property_city &&
      createForm.value.property_postcode
    )
    return hasProperty && createForm.value.monthly_rent
  }
  if (createStep.value === 2) {
    if (tenantCount.value === 1) {
      return createForm.value.tenant_first_name &&
             createForm.value.tenant_last_name &&
             createForm.value.tenant_email &&
             createForm.value.tenant_phone
    } else {
      return tenants.value.every(t =>
        t.first_name && t.last_name && t.email && t.phone && t.rent_share
      )
    }
  }
  return true
})

function openCreateModal() {
  showCreateModal.value = true
  createStep.value = 1
  createForm.value = {
    property_address: '',
    property_city: '',
    property_postcode: '',
    monthly_rent: null,
    move_in_date: '',
    tenant_first_name: '',
    tenant_last_name: '',
    tenant_email: '',
    tenant_phone: '',
    linked_property_id: null
  }
  tenantCount.value = 1
  tenants.value = []
  // Reset property search state
  propertySearchQuery.value = ''
  propertySearchResults.value = []
  selectedProperty.value = null
  isManualEntry.value = false
  showPropertyDropdown.value = false
}

function closeCreateModal() {
  showCreateModal.value = false
}

function updateTenantCount() {
  const count = tenantCount.value
  const rentPerTenant = createForm.value.monthly_rent ? Math.round(createForm.value.monthly_rent / count) : 0

  tenants.value = Array.from({ length: count }, (_, i) => ({
    first_name: tenants.value[i]?.first_name || '',
    last_name: tenants.value[i]?.last_name || '',
    email: tenants.value[i]?.email || '',
    phone: tenants.value[i]?.phone || '',
    rent_share: tenants.value[i]?.rent_share || rentPerTenant
  }))
}

function nextStep() {
  if (createStep.value === 1 && tenantCount.value > 1) {
    updateTenantCount()
  }
  createStep.value++
}

async function submitReference() {
  submitting.value = true

  try {
    const payload: Record<string, any> = {
      property_address: createForm.value.property_address,
      property_city: createForm.value.property_city,
      property_postcode: createForm.value.property_postcode,
      monthly_rent: createForm.value.monthly_rent,
      move_in_date: createForm.value.move_in_date || null,
      tenants: tenantCount.value === 1
        ? [{
            first_name: createForm.value.tenant_first_name,
            last_name: createForm.value.tenant_last_name,
            email: createForm.value.tenant_email,
            phone: createForm.value.tenant_phone,
            rent_share: createForm.value.monthly_rent
          }]
        : tenants.value
    }

    // Include linked property ID if a property was selected
    if (createForm.value.linked_property_id) {
      payload.linkedPropertyId = createForm.value.linked_property_id
    }

    const response = await fetch(`${API_URL}/api/v2/references`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'Content-Type': 'application/json',
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      },
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      closeCreateModal()
      refreshData()
    } else {
      const error = await response.json()
      alert(error.error || 'Failed to create reference')
    }
  } catch (error) {
    console.error('Error creating reference:', error)
    alert('Failed to create reference')
  } finally {
    submitting.value = false
  }
}

async function fetchReferences() {
  loading.value = true
  try {
    const response = await fetch(`${API_URL}/api/v2/references`, {
      headers: {
        'Authorization': `Bearer ${authStore.session?.access_token}`,
        'X-Branch-Id': localStorage.getItem('activeBranchId') || ''
      }
    })
    if (response.ok) {
      const data = await response.json()
      references.value = data.references || []
    }
  } catch (error) {
    console.error('Error fetching V2 references:', error)
  } finally {
    loading.value = false
  }
}

function openDrawer(ref: any) {
  selectedReference.value = ref
  drawerOpen.value = true
}

function refreshData() {
  fetchReferences()
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    'SENT': 'Sent',
    'COLLECTING_EVIDENCE': 'Collecting',
    'READY_FOR_REVIEW': 'Ready for Review',
    'IN_REVIEW': 'In Review',
    'ACTION_REQUIRED': 'Action Required',
    'ACCEPTED': 'Accepted',
    'ACCEPTED_WITH_GUARANTOR': 'Accepted (Guarantor)',
    'ACCEPTED_ON_CONDITION': 'Accepted (Condition)',
    'REJECTED': 'Rejected'
  }
  return labels[status] || status
}

function getStatusClass(status: string) {
  if (['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION'].includes(status)) {
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  }
  if (status === 'REJECTED') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }
  if (status === 'IN_REVIEW' || status === 'READY_FOR_REVIEW') {
    return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  }
  if (status === 'COLLECTING_EVIDENCE') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
  if (status === 'ACTION_REQUIRED') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }
  return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300'
}

function getSectionLabel(type: string) {
  const labels: Record<string, string> = {
    'IDENTITY': 'ID',
    'RTR': 'RTR',
    'INCOME': 'Income',
    'RESIDENTIAL': 'Res',
    'CREDIT': 'Credit',
    'AML': 'AML'
  }
  return labels[type] || type
}

// Sort sections in consistent order
function getSortedSections(sections: any[] | null | undefined) {
  if (!sections || !Array.isArray(sections)) return []
  const order = ['IDENTITY', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML']
  return [...sections].sort((a, b) => {
    return order.indexOf(a.section_type) - order.indexOf(b.section_type)
  })
}

// Block classes for row section indicators
function getSectionBlockClass(section: any) {
  // Completed/passed sections: orange background with white text
  if (section.decision === 'PASS') {
    return 'bg-orange-500 text-white'
  }
  // Failed/rejected sections: red
  if (section.decision === 'FAIL' || section.decision === 'REJECT') {
    return 'bg-red-500 text-white'
  }
  // Everything else (pending, in review, ready for review): gray
  return 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
}

onMounted(() => {
  fetchReferences()
})
</script>

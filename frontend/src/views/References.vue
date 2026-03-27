<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <!-- Top Bar -->
      <ReferencesTopBar
        v-model:search="search"
        v-model:sortBy="sortBy"
        v-model:sortOrder="sortOrder"
        @refresh="loadTenancies"
        @create="showCreateModal = true"
      />

      <!-- Status Tabs -->
      <ReferencesStatusTabs
        v-model="activeTab"
        :counts="statusCounts"
      />

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading State -->
        <div v-if="loading" class="p-6">
          <div class="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-900/50 divide-y divide-gray-100 dark:divide-slate-800">
            <div v-for="i in 5" :key="i" class="px-6 py-4">
              <div class="animate-pulse">
                <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                <div class="h-3 bg-gray-100 dark:bg-slate-800 rounded w-1/2 mb-2"></div>
                <div class="h-3 bg-gray-100 dark:bg-slate-800 rounded w-1/3"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tenancy List -->
        <div v-else-if="filteredTenancies.length > 0" class="px-6 py-4">
          <TenancyRow
            v-for="tenancy in filteredTenancies"
            :key="tenancy.id"
            :tenancy="tenancy"
            :isExpanded="expandedTenancyId === tenancy.id"
            @toggle="toggleExpanded(tenancy.id)"
            @openPerson="(person) => openPersonDrawer(person, tenancy)"
            @chase="handleChase"
            @addGuarantor="handleAddGuarantor(tenancy)"
            @changeMoveInDate="handleChangeMoveInDate"
            @convertToTenancy="handleConvertToTenancy"
          />
        </div>

        <!-- Empty State -->
        <div v-else class="p-6">
          <div class="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-900/50 p-12 text-center">
            <FileText class="mx-auto h-12 w-12 text-gray-400 dark:text-slate-600" />
            <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {{ search ? 'No references found' : 'No references yet' }}
            </h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {{ search ? 'Try adjusting your search terms.' : 'Get started by creating a new tenant reference.' }}
            </p>
            <div v-if="!search" class="mt-6">
              <button
                @click="showCreateModal = true"
                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
              >
                Create New Reference
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Person Drawer -->
      <PersonDrawer
        v-model:open="drawerOpen"
        :person="selectedPerson"
        :tenancy="selectedTenancy"
        @updated="loadTenancies"
        @addGuarantor="handleAddGuarantorFromDrawer"
        @deleteReference="handleDeleteFromDrawer"
      />
    </div>

    <!-- Create Reference Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-slate-900 rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col border border-gray-200 dark:border-slate-700">
        <div class="p-6 pb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Create New Reference</h3>
        </div>
        <form @submit.prevent="handleCreate" class="flex flex-col flex-1 min-h-0">
          <div class="px-6 overflow-y-auto flex-1 space-y-4">
            <!-- Tenant Count Selector -->
            <div>
              <label for="tenant-count" class="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Number of Tenants *</label>
              <select id="tenant-count" v-model.number="tenantCount" @change="updateTenantCount(tenantCount)"
                class="block w-1/3 px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary">
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
              <h4 class="text-md font-semibold text-gray-700 dark:text-slate-200 mb-3">Property Information</h4>

              <!-- Entry Mode Toggle -->
              <div class="mb-4 flex gap-3">
                <button
                  @click="propertyEntryMode = 'select'; fetchProperties()"
                  type="button"
                  class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                  :class="propertyEntryMode === 'select'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600'
                  "
                >
                  <Building class="w-4 h-4" />
                  Select from Properties
                </button>
                <button
                  @click="propertyEntryMode = 'manual'; clearPropertySelection()"
                  type="button"
                  class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                  :class="propertyEntryMode === 'manual'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600'
                  "
                >
                  Enter Manually
                </button>
              </div>

              <!-- Selected Property Banner -->
              <div v-if="selectedPropertyId" class="mb-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3 flex items-center justify-between">
                <div class="flex items-center">
                  <Building class="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                  <span class="text-sm font-medium text-green-900 dark:text-green-200">{{ formData.property_address }}, {{ formData.property_city }} {{ formData.property_postcode }}</span>
                </div>
                <button
                  @click="clearPropertySelection"
                  type="button"
                  class="text-sm text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 font-medium"
                >
                  Clear
                </button>
              </div>

              <!-- Property Selector -->
              <div v-if="propertyEntryMode === 'select' && !selectedPropertyId" class="mb-4 space-y-3">
                <div class="flex gap-3">
                  <div class="flex-1">
                    <input
                      v-model="propertySearchQuery"
                      type="text"
                      placeholder="Search by address or postcode..."
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary"
                      @keyup.enter="fetchProperties"
                    />
                  </div>
                  <button
                    @click="fetchProperties"
                    type="button"
                    :disabled="loadingProperties"
                    class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                  >
                    {{ loadingProperties ? 'Loading...' : 'Search' }}
                  </button>
                </div>

                <!-- Loading State -->
                <div v-if="loadingProperties" class="text-center py-4">
                  <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>

                <!-- No Properties -->
                <div v-else-if="!loadingProperties && availableProperties.length === 0" class="text-center py-4">
                  <p class="text-sm text-gray-600 dark:text-slate-400">
                    {{ propertySearchQuery
                      ? 'No properties match your search'
                      : 'Search by address or postcode to select a property'
                    }}
                  </p>
                </div>

                <!-- Property Cards -->
                <div v-else class="space-y-2">
                  <!-- Results limit warning -->
                  <div v-if="availableProperties.length >= 20" class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded px-2 py-1.5">
                    Showing first 20 results. Refine your search for more specific results.
                  </div>

                  <div class="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                    <div
                      v-for="property in availableProperties"
                      :key="property.id"
                      @click="selectPropertyForReference(property)"
                      class="border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-md p-3 cursor-pointer transition-all hover:shadow-sm hover:border-primary/50 flex items-center justify-between"
                    >
                      <div>
                        <span class="font-medium text-gray-900 dark:text-white">{{ property.address_line1 }}</span>
                        <span class="text-sm text-gray-600 dark:text-slate-400 ml-2">{{ property.city }}, {{ property.postcode }}</span>
                      </div>
                      <svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Manual Entry / Display Fields -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <AddressAutocomplete v-model="formData.property_address" label="Property Address" :required="true"
                    id="address" placeholder="Start typing address..."
                    :disabled="!!selectedPropertyId"
                    @addressSelected="handlePropertyAddressSelected" />
                </div>
                <div>
                  <label for="city" class="block text-sm font-medium text-gray-700 dark:text-slate-200">City *</label>
                  <input id="city" v-model="formData.property_city" type="text" required
                    :disabled="!!selectedPropertyId"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:text-gray-500 dark:disabled:text-slate-400" />
                </div>
                <div>
                  <label for="postcode" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Postcode *</label>
                  <input id="postcode" v-model="formData.property_postcode" type="text" required
                    :disabled="!!selectedPropertyId"
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:text-gray-500 dark:disabled:text-slate-400" />
                </div>
                <div>
                  <label for="rent" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Total Monthly Rent (£) *</label>
                  <input id="rent" v-model.number="formData.monthly_rent" type="number" step="1" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                </div>
              </div>
            </div>

            <!-- Single Tenant Information (v-if tenantCount === 1) -->
            <div v-if="tenantCount === 1">
              <h4 class="text-md font-semibold text-gray-700 dark:text-slate-200 mb-3">Tenant Information</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="first-name" class="block text-sm font-medium text-gray-700 dark:text-slate-200">First Name *</label>
                  <input id="first-name" v-model="formData.tenant_first_name" type="text" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label for="last-name" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Last Name *</label>
                  <input id="last-name" v-model="formData.tenant_last_name" type="text" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label for="email" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Email *</label>
                  <input id="email" v-model="formData.tenant_email" type="email" required
                    class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <PhoneInput v-model="formData.tenant_phone" label="Phone" id="phone" :required="true" />
                </div>
              </div>

              <!-- Guarantor for single tenant -->
              <div class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <div class="flex items-center justify-between mb-3">
                  <h5 class="text-sm font-semibold text-gray-700 dark:text-slate-200">Add Guarantor (Optional)</h5>
                  <button type="button" @click="showGuarantorFields = !showGuarantorFields"
                    class="text-sm text-primary hover:underline">
                    {{ showGuarantorFields ? 'Hide' : 'Show' }}
                  </button>
                </div>

                <div v-if="showGuarantorFields" class="space-y-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                  <p class="text-sm text-gray-600 dark:text-slate-400">Add guarantor details. They will receive an email to complete the
                    reference form.</p>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="guarantor-first-name" class="block text-sm font-medium text-gray-700 dark:text-slate-200">First
                        Name</label>
                      <input id="guarantor-first-name" v-model="formData.guarantor_first_name" type="text"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                    </div>
                    <div>
                      <label for="guarantor-last-name" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Last Name</label>
                      <input id="guarantor-last-name" v-model="formData.guarantor_last_name" type="text"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                    </div>
                    <div>
                      <label for="guarantor-email" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Email</label>
                      <input id="guarantor-email" v-model="formData.guarantor_email" type="email"
                        class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
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
              <h4 class="text-md font-semibold text-gray-700 dark:text-slate-200 mb-3">Tenants</h4>
              <div v-for="(tenant, index) in tenants" :key="index"
                class="mb-4 p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800">
                <h5 class="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-3">Tenant {{ index + 1 }}</h5>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label :for="`tenant-${index}-first-name`" class="block text-sm font-medium text-gray-700 dark:text-slate-200">First
                      Name *</label>
                    <input :id="`tenant-${index}-first-name`" v-model="tenant.first_name" type="text" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                    <label :for="`tenant-${index}-last-name`" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Last Name
                      *</label>
                    <input :id="`tenant-${index}-last-name`" v-model="tenant.last_name" type="text" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                    <label :for="`tenant-${index}-email`" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Email
                      *</label>
                    <input :id="`tenant-${index}-email`" v-model="tenant.email" type="email" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                  </div>
                  <div>
                    <PhoneInput v-model="tenant.phone" :label="`Phone`" :id="`tenant-${index}-phone`"
                      :required="true" />
                  </div>
                  <div class="col-span-2">
                    <label :for="`tenant-${index}-rent-share`" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Rent
                      Share (£) *</label>
                    <input :id="`tenant-${index}-rent-share`" v-model.number="tenant.rent_share" type="number"
                      step="0.01" required
                      class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary"
                      placeholder="0.00" />
                  </div>
                </div>

                <!-- Guarantor for this tenant -->
                <div class="mt-3 pt-3 border-t border-gray-300 dark:border-slate-600">
                  <div class="flex items-center justify-between mb-2">
                    <h6 class="text-sm font-medium text-gray-700 dark:text-slate-200">Add Guarantor (Optional)</h6>
                    <button type="button" @click="tenant.showGuarantorFields = !tenant.showGuarantorFields"
                      class="text-xs text-primary hover:underline">
                      {{ tenant.showGuarantorFields ? 'Hide' : 'Show' }}
                    </button>
                  </div>

                  <div v-if="tenant.showGuarantorFields"
                    class="space-y-3 p-3 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                    <p class="text-xs text-gray-600 dark:text-slate-400">Add guarantor details for this tenant. They will receive an email
                      to complete the reference form.</p>

                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label :for="`tenant-${index}-guarantor-first-name`"
                          class="block text-xs font-medium text-gray-700 dark:text-slate-200">First Name</label>
                        <input :id="`tenant-${index}-guarantor-first-name`" :value="tenant.guarantor?.first_name || ''"
                          @input="(e: Event) => { const target = e.target as HTMLInputElement; if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.first_name = target.value }"
                          type="text"
                          class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                      <div>
                        <label :for="`tenant-${index}-guarantor-last-name`"
                          class="block text-xs font-medium text-gray-700 dark:text-slate-200">Last Name</label>
                        <input :id="`tenant-${index}-guarantor-last-name`" :value="tenant.guarantor?.last_name || ''"
                          @input="(e: Event) => { const target = e.target as HTMLInputElement; if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.last_name = target.value }"
                          type="text"
                          class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                      <div>
                        <label :for="`tenant-${index}-guarantor-email`"
                          class="block text-xs font-medium text-gray-700 dark:text-slate-200">Email</label>
                        <input :id="`tenant-${index}-guarantor-email`" :value="tenant.guarantor?.email || ''"
                          @input="(e: Event) => { const target = e.target as HTMLInputElement; if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.email = target.value }"
                          type="email"
                          class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                      <div>
                        <label :for="`tenant-${index}-guarantor-phone`"
                          class="block text-xs font-medium text-gray-700 dark:text-slate-200">Phone</label>
                        <PhoneInput :modelValue="tenant.guarantor?.phone || ''"
                          @update:modelValue="(val) => { if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.phone = val }"
                          :id="`tenant-${index}-guarantor-phone`" :required="false"
                          input-class="px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary"
                          select-class="px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-600 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Rent Calculator -->
              <div class="p-4 rounded-lg"
                :class="rentSharesValid ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'">
                <div class="flex justify-between items-center">
                  <span class="text-sm font-medium" :class="rentSharesValid ? 'text-green-900 dark:text-green-200' : 'text-red-900 dark:text-red-200'">
                    Total Rent Shares:
                  </span>
                  <span class="text-lg font-bold" :class="rentSharesValid ? 'text-green-900 dark:text-green-200' : 'text-red-900 dark:text-red-200'">
                    £{{ totalRentShare.toFixed(2) }} / £{{ Number(formData.monthly_rent || 0).toFixed(2) }}
                  </span>
                </div>
                <p v-if="!rentSharesValid" class="text-xs text-red-700 dark:text-red-400 mt-2">
                  Rent shares must sum exactly to the total monthly rent
                </p>
                <p v-else class="text-xs text-green-700 dark:text-green-400 mt-2">
                  Rent shares match total rent
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
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Term Length</label>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex items-center gap-2">
                    <label for="term-years" class="text-sm text-gray-600 dark:text-slate-400 whitespace-nowrap">Years</label>
                    <input id="term-years" v-model.number="formData.term_years" type="number" min="0"
                      class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary"
                      placeholder="0" />
                  </div>
                  <div class="flex items-center gap-2">
                    <label for="term-months" class="text-sm text-gray-600 dark:text-slate-400 whitespace-nowrap">Months</label>
                    <input id="term-months" v-model.number="formData.term_months" type="number" min="0" max="11"
                      class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary"
                      placeholder="0" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Internal Notes -->
            <div>
              <label for="notes" class="block text-sm font-medium text-gray-700 dark:text-slate-200">Internal Notes</label>
              <textarea id="notes" v-model="formData.notes" rows="2"
                class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary"
                placeholder="Optional internal notes about this reference..."></textarea>
            </div>

            <div v-if="createError" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded">
              {{ createError }}
            </div>

          </div>

          <!-- Sticky Footer with Buttons -->
          <div class="p-6 pt-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-b-lg">
            <div class="flex justify-end space-x-3">
              <button type="button" @click="closeCreateModal"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md">
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
      <div class="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-slate-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Delete Reference</h3>
        <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
          Are you sure you want to delete the reference for
          <span class="font-medium text-gray-900 dark:text-white">{{ referenceToDelete?.name }}</span>?
          This action cannot be undone.
        </p>

        <!-- Refund Information -->
        <div v-if="refundAmount > 0" class="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md">
          <p class="text-sm text-green-800 dark:text-green-200">
            <span class="font-medium">Credit Refund:</span>
            {{ refundAmount }} {{ refundAmount === 1 ? 'credit' : 'credits' }} will be refunded to your account.
          </p>
        </div>

        <div v-else class="mb-4 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md">
          <p class="text-sm text-gray-600 dark:text-slate-400">
            No credits will be refunded for this reference.
          </p>
        </div>

        <div class="flex justify-end space-x-3">
          <button @click="showDeleteModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700">
            Cancel
          </button>
          <button @click="handleDelete" :disabled="deleteLoading"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50">
            {{ deleteLoading ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add Guarantor Modal -->
    <div v-if="showAddGuarantorModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-slate-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Guarantor</h3>

        <!-- Tenant Selection (if multiple tenants) -->
        <div v-if="tenantsForGuarantor.length > 1" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">Select Tenant *</label>
          <select v-model="selectedTenantForGuarantor"
            class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary">
            <option value="">Select a tenant</option>
            <option v-for="tenant in tenantsForGuarantor" :key="tenant.id" :value="tenant.id">
              {{ tenant.name }}
            </option>
          </select>
        </div>

        <form @submit.prevent="addGuarantor" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-200">First Name *</label>
            <input v-model="guarantorForm.first_name" type="text" required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-200">Last Name *</label>
            <input v-model="guarantorForm.last_name" type="text" required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-200">Email *</label>
            <input v-model="guarantorForm.email" type="email" required
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-200">Phone</label>
            <input v-model="guarantorForm.phone" type="tel"
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:ring-primary focus:border-primary" />
          </div>

          <div v-if="guarantorError" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
            {{ guarantorError }}
          </div>

          <div v-if="guarantorSuccess"
            class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
            {{ guarantorSuccess }}
          </div>

          <div class="flex justify-end space-x-3 pt-4">
            <button type="button" @click="closeGuarantorModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md">
              Cancel
            </button>
            <button type="submit" :disabled="addingGuarantor || (tenantsForGuarantor.length > 1 && !selectedTenantForGuarantor)"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50">
              {{ addingGuarantor ? 'Adding...' : 'Add Guarantor' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Change Move-in Date Modal -->
    <ChangeMoveInDateModal
      :show="showChangeMoveInDateModal"
      :tenancy="selectedTenancyForDateChange"
      @close="showChangeMoveInDateModal = false"
      @saved="handleMoveInDateSaved"
    />

    <!-- Convert to Tenancy Modal -->
    <ConversionModal
      :show="showConversionModal"
      :tenancy="selectedTenancyForConversion"
      @close="showConversionModal = false"
      @converted="handleConversionComplete"
    />
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import PhoneInput from '../components/PhoneInput.vue'
import DatePicker from '../components/DatePicker.vue'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'
import InsufficientCreditsModal from '../components/InsufficientCreditsModal.vue'
import PaymentMethodRequiredModal from '../components/PaymentMethodRequiredModal.vue'
import ReferencesTopBar from '../components/references/ReferencesTopBar.vue'
import ReferencesStatusTabs from '../components/references/ReferencesStatusTabs.vue'
import TenancyRow from '../components/references/TenancyRow.vue'
import PersonDrawer from '../components/references/PersonDrawer.vue'
import ChangeMoveInDateModal from '../components/references/ChangeMoveInDateModal.vue'
import ConversionModal from '../components/references/ConversionModal.vue'
import { useTenancies, type Tenancy, type TenancyPerson, type TabKey } from '../composables/useTenancies'
import { isValidEmail } from '../utils/validation'
import { Building, FileText } from 'lucide-vue-next'
import { authFetch } from '@/lib/authFetch'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const router = useRouter()
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
// Use the tenancies composable
const {
  tenancies,
  statusCounts,
  loading,
  loadTenancies,
  expandedTenancyId,
  toggleExpanded,
  selectedPerson,
  selectedTenancy,
  drawerOpen,
  openPersonDrawer
} = useTenancies()

// Local state
const search = ref('')
const sortBy = ref<'move_in_date' | 'created_at'>('move_in_date')
const sortOrder = ref<'asc' | 'desc'>('asc')
const activeTab = ref<TabKey>('IN_PROGRESS')

// Create modal state
const showCreateModal = ref(false)
const showGuarantorFields = ref(false)
const showInsufficientCreditsModal = ref(false)
const showPaymentMethodModal = ref(false)
const createLoading = ref(false)
const createError = ref('')

// Delete modal state
const showDeleteModal = ref(false)
const referenceToDelete = ref<{ id: string, name: string } | null>(null)
const deleteLoading = ref(false)

// Calculate refund amount for the reference being deleted
const refundAmount = computed(() => {
  if (!referenceToDelete.value) return 0

  // Find the person in the tenancies list
  let personToDelete: TenancyPerson | undefined
  let tenancy: Tenancy | undefined

  for (const t of tenancies.value) {
    const person = t.people.find(p => p.id === referenceToDelete.value?.id)
    if (person) {
      personToDelete = person
      tenancy = t
      break
    }
  }

  if (!personToDelete) return 0

  // Statuses that are NOT eligible for refund (same as non-deletable)
  const nonRefundableStates = ['COMPLETED', 'REJECTED']

  if (nonRefundableStates.includes(personToDelete.verificationState)) {
    return 0
  }

  let refund = 0

  // If deleting a tenant, refund 1 credit
  if (personToDelete.role === 'TENANT') {
    refund += 1

    // Also count guarantors for this tenant
    if (tenancy) {
      const guarantors = tenancy.people.filter(
        p => p.role === 'GUARANTOR' &&
        p.guarantorForTenantId === personToDelete?.id &&
        !nonRefundableStates.includes(p.verificationState)
      )
      refund += guarantors.length * 0.5
    }
  } else if (personToDelete.role === 'GUARANTOR') {
    // If deleting a guarantor, refund 0.5 credits
    refund += 0.5
  }

  return refund
})

// Add Guarantor modal state
const showAddGuarantorModal = ref(false)

// Change Move-in Date modal state
const showChangeMoveInDateModal = ref(false)
const selectedTenancyForDateChange = ref<Tenancy | null>(null)

// Convert to Tenancy modal state
const showConversionModal = ref(false)
const selectedTenancyForConversion = ref<Tenancy | null>(null)
const addingGuarantor = ref(false)
const guarantorError = ref('')
const guarantorSuccess = ref('')
const selectedTenantForGuarantor = ref('')
const tenancyForGuarantor = ref<Tenancy | null>(null)
const guarantorForm = ref({
  first_name: '',
  last_name: '',
  email: '',
  phone: ''
})

// Multi-tenant form state
const tenantCount = ref(1)
const previousTenantCount = ref(1)
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
  monthly_rent: null as number | null,
  move_in_date: '',
  term_years: 0,
  term_months: 0,
  notes: '',
  guarantor_first_name: '',
  guarantor_last_name: '',
  guarantor_email: '',
  guarantor_phone: ''
})

// Property selection state (for linking to Properties module)
const propertyEntryMode = ref<'select' | 'manual'>('manual')
const availableProperties = ref<any[]>([])
const loadingProperties = ref(false)
const propertySearchQuery = ref('')
const selectedPropertyId = ref<string | null>(null)

// Fetch properties for selection
async function fetchProperties() {
  loadingProperties.value = true
  try {
    const token = authStore.session?.access_token

    if (!token) return

    // Build query params with search and limit
    const params = new URLSearchParams()
    if (propertySearchQuery.value) {
      params.append('search', propertySearchQuery.value)
    }
    params.append('limit', '20') // Limit to 20 results for performance

    const response = await authFetch(`${API_URL}/api/properties?${params.toString()}`, {
      token
    })

    if (response.ok) {
      const { properties } = await response.json()
      availableProperties.value = properties || []
    }
  } catch (err) {
    console.error('Error fetching properties:', err)
    toast.error('Failed to load properties')
  } finally {
    loadingProperties.value = false
  }
}

// Select a property and auto-fill address
function selectPropertyForReference(property: any) {
  selectedPropertyId.value = property.id

  // Auto-fill the address fields
  formData.value.property_address = property.address_line1 || ''
  formData.value.property_city = property.city || ''
  formData.value.property_postcode = property.postcode || ''

  toast.success('Property selected - address fields filled')
}

// Clear property selection
function clearPropertySelection() {
  selectedPropertyId.value = null
  formData.value.property_address = ''
  formData.value.property_city = ''
  formData.value.property_postcode = ''
  propertyEntryMode.value = 'manual'
}

// Computed
const filteredTenancies = computed(() => {
  let filtered = tenancies.value

  // Filter by status tab
  if (activeTab.value !== 'ALL') {
    const today = new Date().toISOString().slice(0, 10)
    if (activeTab.value === 'MOVED_IN') {
      filtered = filtered.filter(t =>
        t.tenancyStatus === 'COMPLETED' && t.moveInDate && t.moveInDate < today
      )
    } else if (activeTab.value === 'COMPLETED') {
      filtered = filtered.filter(t =>
        t.tenancyStatus === 'COMPLETED' && (!t.moveInDate || t.moveInDate >= today)
      )
    } else if (activeTab.value === 'IN_PROGRESS') {
      // Include IN_PROGRESS, COLLECTING_EVIDENCE, and SENT statuses
      filtered = filtered.filter(t =>
        ['IN_PROGRESS', 'COLLECTING_EVIDENCE', 'SENT'].includes(t.tenancyStatus)
      )
    } else {
      filtered = filtered.filter(t => t.tenancyStatus === activeTab.value)
    }
  }

  // Filter by search
  if (search.value.trim()) {
    const query = search.value.toLowerCase().trim()
    filtered = filtered.filter(t => {
      const address = t.propertyAddress.toLowerCase()
      const city = (t.propertyCity || '').toLowerCase()
      const postcode = (t.propertyPostcode || '').toLowerCase()
      const peopleMatch = t.people.some(p =>
        p.name.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query)
      )
      return address.includes(query) ||
             city.includes(query) ||
             postcode.includes(query) ||
             peopleMatch
    })
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let aValue: number
    let bValue: number

    if (sortBy.value === 'move_in_date') {
      aValue = a.moveInDate ? new Date(a.moveInDate).getTime() : 0
      bValue = b.moveInDate ? new Date(b.moveInDate).getTime() : 0
    } else {
      aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0
      bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0
    }

    return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue
  })

  return sorted
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

// Get tenants without guarantors for the selected tenancy
const tenantsForGuarantor = computed(() => {
  if (!tenancyForGuarantor.value) return []
  // Get IDs of tenants who already have guarantors
  const guarantorForTenantIds = tenancyForGuarantor.value.people
    .filter(p => p.role === 'GUARANTOR' && p.guarantorForTenantId)
    .map(p => p.guarantorForTenantId)
  // Return tenants who don't already have a guarantor
  return tenancyForGuarantor.value.people
    .filter(p => p.role === 'TENANT' && !guarantorForTenantIds.includes(p.id))
})

// Watchers
watch(() => formData.value.monthly_rent, () => {
  distributeRentEvenly()
})

// Methods
const distributeRentEvenly = () => {
  if (tenantCount.value <= 1) return
  const monthlyRent = Number(formData.value.monthly_rent) || 0
  if (monthlyRent <= 0) return

  const sharePerTenant = Math.floor((monthlyRent / tenantCount.value) * 100) / 100
  const remainder = Math.round((monthlyRent - (sharePerTenant * tenantCount.value)) * 100) / 100

  tenants.value.forEach((tenant, index) => {
    tenant.rent_share = index === 0
      ? Math.round((sharePerTenant + remainder) * 100) / 100
      : sharePerTenant
  })
}

const updateTenantCount = (count: number) => {
  const previousCount = previousTenantCount.value
  tenantCount.value = count

  if (previousCount === 1 && count > 1) {
    tenants.value[0] = {
      first_name: formData.value.tenant_first_name,
      last_name: formData.value.tenant_last_name,
      email: formData.value.tenant_email,
      phone: formData.value.tenant_phone,
      rent_share: null,
      guarantor: (formData.value.guarantor_first_name || formData.value.guarantor_email) ? {
        first_name: formData.value.guarantor_first_name,
        last_name: formData.value.guarantor_last_name,
        email: formData.value.guarantor_email,
        phone: formData.value.guarantor_phone
      } : null,
      showGuarantorFields: showGuarantorFields.value
    }
  }

  if (previousCount > 1 && count === 1) {
    formData.value.tenant_first_name = tenants.value[0]?.first_name || ''
    formData.value.tenant_last_name = tenants.value[0]?.last_name || ''
    formData.value.tenant_email = tenants.value[0]?.email || ''
    formData.value.tenant_phone = tenants.value[0]?.phone || ''

    if (tenants.value[0]?.guarantor) {
      formData.value.guarantor_first_name = tenants.value[0].guarantor.first_name || ''
      formData.value.guarantor_last_name = tenants.value[0].guarantor.last_name || ''
      formData.value.guarantor_email = tenants.value[0].guarantor.email || ''
      formData.value.guarantor_phone = tenants.value[0].guarantor.phone || ''
      showGuarantorFields.value = true
    }
  }

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

  distributeRentEvenly()
  previousTenantCount.value = count
}

const handlePropertyAddressSelected = (addressData: any) => {
  formData.value.property_address = addressData.addressLine1
  formData.value.property_city = addressData.city
  formData.value.property_postcode = addressData.postcode
}

const handleCreate = async () => {
  createLoading.value = true
  createError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      createError.value = 'No auth token available'
      return
    }

    if (!formData.value.move_in_date) {
      createError.value = 'Move-in date is required'
      createLoading.value = false
      return
    }

    // Validate emails
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
      for (let i = 0; i < tenants.value.length; i++) {
        const tenant = tenants.value[i]
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

    let payload: any

    if (tenantCount.value === 1) {
      payload = { ...formData.value }
      // Include linked_property_id if a property was selected
      if (selectedPropertyId.value) {
        payload.linked_property_id = selectedPropertyId.value
      }
    } else {
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
      // Include linked_property_id if a property was selected
      if (selectedPropertyId.value) {
        payload.linked_property_id = selectedPropertyId.value
      }
    }

    const response = await authFetch(`${API_URL}/api/references`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      if (response.status === 402) {
        const errorData = await response.json()
        closeCreateModal()

        if (errorData.requires_payment_method || errorData.error === 'Payment Method Required') {
          showPaymentMethodModal.value = true
        } else {
          showInsufficientCreditsModal.value = true
        }
        return
      }

      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create reference')
    }

    const successMessage = tenantCount.value > 1
      ? `Reference created successfully for ${tenantCount.value} tenants!`
      : 'Reference created successfully!'
    toast.success(successMessage)

    closeCreateModal()
    loadTenancies()
  } catch (error: any) {
    createError.value = error.message || 'Failed to create reference'
  } finally {
    createLoading.value = false
  }
}

const closeCreateModal = () => {
  showCreateModal.value = false
  tenantCount.value = 1
  previousTenantCount.value = 1
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
  // Reset property selection state
  propertyEntryMode.value = 'manual'
  selectedPropertyId.value = null
  propertySearchQuery.value = ''
  availableProperties.value = []
}

const handleCreditsPurchased = () => {
  showInsufficientCreditsModal.value = false
  showCreateModal.value = true
}

const handleChase = async (person: TenancyPerson) => {
  try {
    const token = authStore.session?.access_token
    if (!token) {
      toast.error('No auth token available')
      return
    }

    // Get chase dependencies for this person
    const depsResponse = await authFetch(`${API_URL}/api/chase/agent/reference/${person.id}`, {
      token,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!depsResponse.ok) {
      throw new Error('Failed to get chase dependencies')
    }

    const { dependencies } = await depsResponse.json()

    // Chase all available dependencies
    let chaseCount = 0
    let earliestCooldownEnd: Date | null = null

    for (const dep of dependencies) {
      if (dep.canChase) {
        const chaseResponse = await authFetch(`${API_URL}/api/chase/agent/${dep.id}`, {
          method: 'POST',
          token,
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (chaseResponse.ok) {
          chaseCount++
        }
      } else if (dep.cooldownEnds) {
        // Track earliest cooldown end time
        const cooldownEnd = new Date(dep.cooldownEnds)
        if (!earliestCooldownEnd || cooldownEnd < earliestCooldownEnd) {
          earliestCooldownEnd = cooldownEnd
        }
      }
    }

    if (chaseCount > 0) {
      toast.success(`Chase sent for ${chaseCount} outstanding item(s)`)
    } else if (earliestCooldownEnd) {
      // Show when the cooldown ends
      const now = new Date()
      const diffMs = earliestCooldownEnd.getTime() - now.getTime()
      const diffMins = Math.ceil(diffMs / (1000 * 60))

      if (diffMins > 60) {
        const hours = Math.floor(diffMins / 60)
        const mins = diffMins % 60
        toast.info(`Chase available again in ${hours}h ${mins}m`)
      } else {
        toast.info(`Chase available again in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`)
      }
    } else {
      toast.info('No items available to chase at this time')
    }
  } catch (error: any) {
    console.error('Failed to chase:', error)
    toast.error(error.message || 'Failed to send chase')
  }
}

const handleAddGuarantor = (tenancy: Tenancy) => {
  // Set the tenancy and reset form
  tenancyForGuarantor.value = tenancy
  guarantorForm.value = { first_name: '', last_name: '', email: '', phone: '' }
  guarantorError.value = ''
  guarantorSuccess.value = ''

  // Get tenants without guarantors
  const availableTenants = tenantsForGuarantor.value

  if (availableTenants.length === 0) {
    toast.info('All tenants in this tenancy already have guarantors')
    return
  }

  // Auto-select if only one tenant
  if (availableTenants.length === 1 && availableTenants[0]) {
    selectedTenantForGuarantor.value = availableTenants[0].id
  } else {
    selectedTenantForGuarantor.value = ''
  }

  showAddGuarantorModal.value = true
}

const handleChangeMoveInDate = (tenancy: Tenancy) => {
  selectedTenancyForDateChange.value = tenancy
  showChangeMoveInDateModal.value = true
}

const handleMoveInDateSaved = () => {
  loadTenancies()
}

const handleConvertToTenancy = (tenancy: Tenancy) => {
  selectedTenancyForConversion.value = tenancy
  showConversionModal.value = true
}

const handleConversionComplete = () => {
  showConversionModal.value = false
  selectedTenancyForConversion.value = null
  loadTenancies()
  toast.success('Reference successfully converted to active tenancy!')
}

// Handler for when add guarantor is triggered from the PersonDrawer
const handleAddGuarantorFromDrawer = (tenantId: string) => {
  // Use the selectedTenancy which should still be set from the drawer
  if (!selectedTenancy.value) return

  // Set the tenancy and reset form
  tenancyForGuarantor.value = selectedTenancy.value
  guarantorForm.value = { first_name: '', last_name: '', email: '', phone: '' }
  guarantorError.value = ''
  guarantorSuccess.value = ''

  // Pre-select the tenant that was clicked
  selectedTenantForGuarantor.value = tenantId

  showAddGuarantorModal.value = true
}

// Handler for when delete is triggered from the PersonDrawer
const handleDeleteFromDrawer = (person: { id: string, name: string }) => {
  referenceToDelete.value = person
  showDeleteModal.value = true
}

const closeGuarantorModal = () => {
  showAddGuarantorModal.value = false
  tenancyForGuarantor.value = null
  selectedTenantForGuarantor.value = ''
  guarantorForm.value = { first_name: '', last_name: '', email: '', phone: '' }
  guarantorError.value = ''
  guarantorSuccess.value = ''
}

const addGuarantor = async () => {
  if (!tenancyForGuarantor.value) return

  // Validate tenant selection if multiple tenants
  const firstTenant = tenantsForGuarantor.value[0]
  const tenantId = tenantsForGuarantor.value.length === 1 && firstTenant
    ? firstTenant.id
    : selectedTenantForGuarantor.value

  if (!tenantId) {
    guarantorError.value = 'Please select a tenant'
    return
  }

  // Validate form
  if (!guarantorForm.value.first_name || !guarantorForm.value.last_name || !guarantorForm.value.email) {
    guarantorError.value = 'Please fill in all required fields'
    return
  }

  if (!isValidEmail(guarantorForm.value.email)) {
    guarantorError.value = 'Please enter a valid email address'
    return
  }

  addingGuarantor.value = true
  guarantorError.value = ''
  guarantorSuccess.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) {
      guarantorError.value = 'Not authenticated'
      return
    }

    const response = await authFetch(`${API_URL}/api/references/${tenantId}/add-guarantor`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        guarantor_first_name: guarantorForm.value.first_name,
        guarantor_last_name: guarantorForm.value.last_name,
        guarantor_email: guarantorForm.value.email,
        guarantor_phone: guarantorForm.value.phone || null
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to add guarantor')
    }

    guarantorSuccess.value = 'Guarantor added successfully! An email has been sent to them.'
    await loadTenancies()

    // Close modal after a short delay
    setTimeout(() => {
      closeGuarantorModal()
    }, 1500)
  } catch (error: any) {
    console.error('Failed to add guarantor:', error)
    guarantorError.value = error.message || 'Failed to add guarantor'
  } finally {
    addingGuarantor.value = false
  }
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

    const response = await authFetch(`${API_URL}/api/references/${referenceToDelete.value.id}`, {
      method: 'DELETE',
      token,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to delete reference')
    }

    // Parse response to get refund information
    const data = await response.json()
    const creditsRefunded = data.credits_refunded || 0

    showDeleteModal.value = false
    referenceToDelete.value = null
    await loadTenancies()

    // Show success message with refund info
    if (creditsRefunded > 0) {
      toast.success(`Reference deleted successfully. ${creditsRefunded} ${creditsRefunded === 1 ? 'credit' : 'credits'} refunded.`)
    } else {
      toast.success('Reference deleted successfully')
    }
  } catch (error: any) {
    console.error('Failed to delete reference:', error)
    toast.error(error.message || 'Failed to delete reference')
  } finally {
    deleteLoading.value = false
  }
}

// Event handlers
const handleOpenCreateModal = () => {
  showCreateModal.value = true
}

// URL sync for person drawer
const updateUrlWithPerson = (personId: string | null) => {
  const query = { ...route.query }
  if (personId) {
    query.person = personId
  } else {
    delete query.person
  }
  router.replace({ query })
}

// Watch drawer state to sync URL
watch(drawerOpen, (isOpen) => {
  if (isOpen && selectedPerson.value) {
    updateUrlWithPerson(selectedPerson.value.id)
  } else if (!isOpen) {
    updateUrlWithPerson(null)
  }
})

// Open drawer from URL param after tenancies load
const openDrawerFromUrl = (): boolean => {
  const personId = route.query.person
  if (personId && typeof personId === 'string') {
    // Find the person across all tenancies
    for (const tenancy of tenancies.value) {
      const person = tenancy.people.find(p => p.id === personId)
      if (person) {
        openPersonDrawer(person, tenancy)
        expandedTenancyId.value = tenancy.id
        return true
      }
    }
  }
  return false
}

// Watch tenancies data to retry opening drawer from URL param
// Handles race conditions where data hasn't loaded when openDrawerFromUrl first runs
watch(tenancies, () => {
  const personId = route.query.person
  if (personId && typeof personId === 'string' && !drawerOpen.value) {
    openDrawerFromUrl()
  }
})

// Lifecycle
onMounted(async () => {
  await loadTenancies()

  // Check for person in URL after tenancies load
  openDrawerFromUrl()

  if (route.query.create === 'true') {
    showCreateModal.value = true
    router.replace('/references')
  }

  if (route.query.status && typeof route.query.status === 'string') {
    const status = route.query.status.toUpperCase()
    if (['IN_PROGRESS', 'ACTION_REQUIRED', 'COMPLETED', 'MOVED_IN', 'REJECTED'].includes(status)) {
      activeTab.value = status as TabKey
    }
  }

  // Handle search query from URL (e.g., from dashboard calendar click)
  if (route.query.search && typeof route.query.search === 'string') {
    search.value = route.query.search
    // Clear the search param from URL to avoid confusion on refresh
    router.replace({ path: '/references', query: {} })
  }

  window.addEventListener('open-create-reference-modal', handleOpenCreateModal)
})

onUnmounted(() => {
  window.removeEventListener('open-create-reference-modal', handleOpenCreateModal)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click.self="handleBackdropClick"
    >
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/50 transition-opacity" />

      <!-- Modal -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div
          class="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl transform transition-all"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ currentStep === 'preview' ? 'Preview Agreement' : 'Generate Agreement' }}
              </h2>
              <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">
                {{ stepDescription }}
              </p>
            </div>
            <button
              @click="handleClose"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Progress Steps -->
          <div v-if="currentStep !== 'preview'" class="px-6 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
            <div class="flex items-center justify-center gap-2">
              <template v-for="(step, index) in steps" :key="step.key">
                <div class="flex items-center">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
                    :class="getStepClass(step.key)"
                  >
                    <Check v-if="isStepComplete(step.key)" class="w-4 h-4" />
                    <span v-else>{{ index + 1 }}</span>
                  </div>
                  <span
                    class="ml-2 text-sm font-medium hidden sm:inline"
                    :class="currentStep === step.key ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'"
                  >
                    {{ step.label }}
                  </span>
                </div>
                <ChevronRight v-if="index < steps.length - 1" class="w-4 h-4 text-gray-300 dark:text-slate-600 mx-2" />
              </template>
            </div>
          </div>

          <!-- Content -->
          <div class="p-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
            <!-- Step 1: Template Selection -->
            <div v-if="currentStep === 'template'" class="space-y-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Agreement Type *</label>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    v-for="opt in agreementTypeOptions"
                    :key="opt.value"
                    @click="formData.agreementType = opt.value as any"
                    type="button"
                    class="p-4 border-2 rounded-lg text-left transition-colors"
                    :class="formData.agreementType === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'"
                  >
                    <span class="font-medium text-gray-900 dark:text-white">{{ opt.label }}</span>
                    <p v-if="opt.description" class="text-xs text-gray-500 dark:text-slate-400 mt-1">{{ opt.description }}</p>
                  </button>
                </div>
                <p v-if="isAPTA" class="text-xs text-amber-600 mt-2">
                  Renters' Rights Act 2025 — APTA is mandatory for tenancies starting on or after 1 May 2026.
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Deposit Scheme *</label>
                <select
                  v-model="formData.depositSchemeType"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option value="">Select deposit scheme...</option>
                  <option v-for="opt in depositSchemeOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Language</label>
                <div class="flex gap-3">
                  <button
                    @click="formData.language = 'english'"
                    type="button"
                    class="px-4 py-2 border-2 rounded-lg transition-colors text-gray-900 dark:text-white"
                    :class="formData.language === 'english'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'"
                  >
                    English
                  </button>
                  <button
                    @click="formData.language = 'welsh'"
                    type="button"
                    class="px-4 py-2 border-2 rounded-lg transition-colors text-gray-900 dark:text-white"
                    :class="formData.language === 'welsh'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'"
                  >
                    Welsh
                  </button>
                </div>
              </div>
            </div>

            <!-- Step 2: Review Details -->
            <div v-if="currentStep === 'details'" class="space-y-6">
              <!-- Property Summary -->
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">Property</h4>
                <p class="text-gray-900 dark:text-white font-medium">
                  {{ formatAddress(formData.propertyAddress) }}
                </p>
              </div>

              <!-- Dates & Financials -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tenancy Start Date *</label>
                  <input
                    v-model="formData.tenancyStartDate"
                    type="date"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tenancy End Date</label>
                  <input
                    v-model="formData.tenancyEndDate"
                    type="date"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Monthly Rent *</label>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-gray-500 dark:text-slate-400">£</span>
                    <input
                      v-model.number="formData.rentAmount"
                      type="number"
                      step="0.01"
                      class="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Deposit Amount *</label>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-gray-500 dark:text-slate-400">£</span>
                    <input
                      v-model.number="formData.depositAmount"
                      type="number"
                      step="0.01"
                      class="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Rent Due Date</label>
                <select
                  v-model="formData.rentDueDay"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option v-for="day in rentDueDayOptions" :key="day" :value="day">
                    {{ day }} of each month
                  </option>
                </select>
              </div>

              <!-- Break Clause -->
              <div class="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                <label class="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="formData.breakClauseEnabled"
                    class="rounded border-gray-300 dark:border-slate-600 text-primary focus:ring-primary"
                  />
                  <span class="ml-2 text-sm font-medium text-gray-700 dark:text-slate-300">Include break clause</span>
                </label>

                <div v-if="formData.breakClauseEnabled" class="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">After months</label>
                    <input
                      v-model.number="formData.breakClauseMonths"
                      type="number"
                      min="1"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Notice period (months)</label>
                    <input
                      v-model.number="formData.breakClauseNoticePeriod"
                      type="number"
                      min="1"
                      max="6"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div v-if="generatedBreakClause" class="col-span-2 bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
                    <p class="text-xs text-gray-500 dark:text-slate-400 mb-1">Generated clause:</p>
                    <p class="text-sm text-gray-700 dark:text-slate-300">{{ generatedBreakClause }}</p>
                  </div>
                </div>
              </div>

              <!-- Bills Included Utilities -->
              <div>
                <p class="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Bills included in rent</p>
                <div class="grid grid-cols-2 gap-2">
                  <label v-for="utility in utilityOptions" :key="utility.value" class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      :value="utility.value"
                      v-model="formData.billsIncludedUtilities"
                      class="rounded border-gray-300 dark:border-slate-600 text-primary focus:ring-primary"
                    />
                    <span class="text-sm text-gray-700 dark:text-slate-300">{{ utility.label }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Step 3: Parties -->
            <div v-if="currentStep === 'parties'" class="space-y-6">
              <!-- Landlords -->
              <div>
                <div class="flex justify-between items-center mb-3">
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white">Landlords</h4>
                  <button
                    v-if="formData.landlords.length < 20"
                    @click="addLandlord"
                    type="button"
                    class="text-sm text-primary hover:text-primary/80"
                  >
                    + Add Landlord
                  </button>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="(landlord, index) in formData.landlords"
                    :key="'ll-' + index"
                    class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3"
                  >
                    <div class="flex justify-between items-start mb-2">
                      <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Landlord {{ index + 1 }}</span>
                      <button
                        v-if="formData.landlords.length > 1"
                        @click="removeLandlord(index)"
                        type="button"
                        class="text-xs text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        v-model="landlord.name"
                        type="text"
                        placeholder="Full name"
                        class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                      <input
                        v-model="landlord.email"
                        type="email"
                        placeholder="Email"
                        class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <!-- Address editing -->
                    <div class="mt-2">
                      <div v-if="editingLandlordAddress === index" class="space-y-2">
                        <AddressAutocomplete
                          v-model="addressSearchQuery"
                          placeholder="Search for address..."
                          :id="'landlord-address-' + index"
                          @address-selected="(addr) => handleLandlordAddressSelected(index, addr)"
                        />
                        <button
                          @click="editingLandlordAddress = null"
                          type="button"
                          class="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                      <div v-else class="flex items-center gap-2">
                        <span class="text-xs text-gray-500 dark:text-slate-400">
                          {{ formatAddress(landlord.address) || 'No address' }}
                        </span>
                        <button
                          @click="editingLandlordAddress = index; addressSearchQuery = ''"
                          type="button"
                          class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <Pencil class="w-3 h-3" />
                          {{ formatAddress(landlord.address) ? 'Edit' : 'Add' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Management Type & Bank Details -->
              <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Management & Payment Details</h4>

                <!-- Management Type Selector -->
                <div class="mb-4">
                  <label class="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-2">Management Type</label>
                  <div class="flex gap-3">
                    <button
                      @click="formData.managementType = 'managed'"
                      type="button"
                      class="flex-1 p-3 border-2 rounded-lg text-left transition-colors"
                      :class="formData.managementType === 'managed'
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'"
                    >
                      <span class="font-medium text-gray-900 dark:text-white text-sm">Fully Managed</span>
                      <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Agent manages property</p>
                    </button>
                    <button
                      @click="formData.managementType = 'let_only'"
                      type="button"
                      class="flex-1 p-3 border-2 rounded-lg text-left transition-colors"
                      :class="formData.managementType === 'let_only'
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'"
                    >
                      <span class="font-medium text-gray-900 dark:text-white text-sm">Let Only</span>
                      <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">Landlord manages property</p>
                    </button>
                  </div>
                </div>

                <!-- Agency Details (for managed - read only, from agency settings) -->
                <div v-if="formData.managementType === 'managed'" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 class="text-sm font-medium text-blue-800 mb-2">Agency Details</h5>
                  <p class="text-xs text-blue-600 mb-3">These details are pulled from your agency settings and will appear on the agreement.</p>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-600">Agency Name:</span>
                      <span class="font-medium text-gray-900">{{ companyDetails?.name || 'Not set' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">Address:</span>
                      <span class="font-medium text-gray-900 text-right max-w-[60%]">
                        <template v-if="companyDetails?.addressLine1">
                          {{ companyDetails.addressLine1 }}<template v-if="companyDetails.addressLine2">, {{ companyDetails.addressLine2 }}</template><template v-if="companyDetails.city">, {{ companyDetails.city }}</template><template v-if="companyDetails.postcode"> {{ companyDetails.postcode }}</template>
                        </template>
                        <template v-else>Not set</template>
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">Account Name:</span>
                      <span class="font-medium text-gray-900">{{ formData.bankAccountName || 'Not set' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">Account Number:</span>
                      <span class="font-medium text-gray-900">{{ formData.bankAccountNumber || 'Not set' }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">Sort Code:</span>
                      <span class="font-medium text-gray-900">{{ formData.bankSortCode || 'Not set' }}</span>
                    </div>
                  </div>
                  <p v-if="!companyDetails?.name || (!formData.bankAccountName && !formData.bankAccountNumber)" class="text-xs text-amber-600 mt-2">
                    ⚠️ Some agency details not configured. Please update in Settings.
                  </p>
                </div>

                <!-- Bank Details (for let_only - from landlord or manual entry) -->
                <div v-if="formData.managementType === 'let_only'" class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h5 class="text-sm font-medium text-amber-800 mb-2">Landlord Bank Details</h5>
                  <p class="text-xs text-amber-600 mb-3">
                    {{ (formData.bankAccountName || formData.bankAccountNumber) ? 'Pulled from landlord card. Edit if needed.' : 'Enter bank details for rent payments.' }}
                  </p>
                  <div class="space-y-3">
                    <input
                      v-model="formData.bankAccountName"
                      type="text"
                      placeholder="Account name"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                    <div class="grid grid-cols-2 gap-3">
                      <input
                        v-model="formData.bankAccountNumber"
                        type="text"
                        placeholder="Account number"
                        maxlength="8"
                        class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                      <input
                        v-model="formData.bankSortCode"
                        type="text"
                        placeholder="Sort code"
                        maxlength="8"
                        class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tenants -->
              <div>
                <div class="flex justify-between items-center mb-3">
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white">Tenants</h4>
                  <button
                    v-if="formData.tenants.length < 20"
                    @click="addTenant"
                    type="button"
                    class="text-sm text-primary hover:text-primary/80"
                  >
                    + Add Tenant
                  </button>
                </div>
                <div class="space-y-3">
                  <div
                    v-for="(tenant, index) in formData.tenants"
                    :key="'t-' + index"
                    class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3"
                  >
                    <div class="flex justify-between items-start mb-2">
                      <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Tenant {{ index + 1 }}</span>
                      <button
                        v-if="formData.tenants.length > 1"
                        @click="removeTenant(index)"
                        type="button"
                        class="text-xs text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        v-model="tenant.name"
                        type="text"
                        placeholder="Full name"
                        class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                      <input
                        v-model="tenant.email"
                        type="email"
                        placeholder="Email (optional)"
                        class="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <!-- Address editing -->
                    <div class="mt-2">
                      <div v-if="editingTenantAddress === index" class="space-y-2">
                        <AddressAutocomplete
                          v-model="addressSearchQuery"
                          placeholder="Search for address..."
                          :id="'tenant-address-' + index"
                          @address-selected="(addr) => handleTenantAddressSelected(index, addr)"
                        />
                        <button
                          @click="editingTenantAddress = null"
                          type="button"
                          class="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                      <div v-else class="flex items-center gap-2">
                        <span class="text-xs text-gray-500 dark:text-slate-400">
                          {{ formatAddress(tenant.address) || 'No address' }}
                        </span>
                        <button
                          @click="editingTenantAddress = index; addressSearchQuery = ''"
                          type="button"
                          class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <Pencil class="w-3 h-3" />
                          {{ formatAddress(tenant.address) ? 'Edit' : 'Add' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Guarantors -->
              <div>
                <div class="flex justify-between items-center mb-3">
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white">Guarantors (Optional)</h4>
                  <button
                    @click="addGuarantor"
                    type="button"
                    class="text-sm text-primary hover:text-primary/80"
                  >
                    + Add Guarantor
                  </button>
                </div>
                <div v-if="formData.guarantors.length === 0" class="text-sm text-gray-500 dark:text-slate-400 text-center py-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  No guarantors added
                </div>
                <div v-else class="space-y-3">
                  <div
                    v-for="(guarantor, index) in formData.guarantors"
                    :key="'g-' + index"
                    class="bg-gray-50 dark:bg-slate-800 rounded-lg p-3"
                  >
                    <div class="flex justify-between items-start mb-2">
                      <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Guarantor {{ index + 1 }}</span>
                      <button
                        @click="removeGuarantor(index)"
                        type="button"
                        class="text-xs text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        v-model="guarantor.name"
                        type="text"
                        placeholder="Full name"
                        class="px-3 py-2 text-sm border rounded-lg focus:ring-primary focus:border-primary"
                        :class="!guarantor.name ? 'border-red-300 bg-red-50' : 'border-gray-300'"
                      />
                      <input
                        v-model="guarantor.email"
                        type="email"
                        placeholder="Email (required)"
                        class="px-3 py-2 text-sm border rounded-lg focus:ring-primary focus:border-primary"
                        :class="!guarantor.email || !isValidEmail(guarantor.email) ? 'border-red-300 bg-red-50' : 'border-gray-300'"
                      />
                    </div>
                    <p v-if="!guarantor.email || !isValidEmail(guarantor.email)" class="text-xs text-red-500 mt-1">
                      Email is required for agreement signing
                    </p>
                    <!-- Address editing -->
                    <div class="mt-2">
                      <div v-if="editingGuarantorAddress === index" class="space-y-2">
                        <AddressAutocomplete
                          v-model="addressSearchQuery"
                          placeholder="Search for address..."
                          :id="'guarantor-address-' + index"
                          @address-selected="(addr) => handleGuarantorAddressSelected(index, addr)"
                        />
                        <button
                          @click="editingGuarantorAddress = null"
                          type="button"
                          class="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                      <div v-else class="flex items-center gap-2">
                        <span
                          class="text-xs"
                          :class="!guarantor.address?.line1 || !guarantor.address?.city || !guarantor.address?.postcode ? 'text-red-500' : 'text-gray-500'"
                        >
                          {{ formatAddress(guarantor.address) || 'No address (required)' }}
                        </span>
                        <button
                          @click="editingGuarantorAddress = index; addressSearchQuery = ''"
                          type="button"
                          class="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <Pencil class="w-3 h-3" />
                          {{ formatAddress(guarantor.address) ? 'Edit' : 'Add' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 4: Special Clauses -->
            <div v-if="currentStep === 'clauses'" class="space-y-6">
              <!-- Break Clause Preview -->
              <div v-if="formData.breakClauseEnabled && formData.breakClause" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="text-sm font-medium text-blue-900 mb-2">Break Clause (will be included)</h4>
                <p class="text-sm text-blue-800">{{ formData.breakClause }}</p>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Special Clauses</label>
                <p class="text-sm text-gray-500 dark:text-slate-400 mb-3">
                  Add any property-specific terms or conditions. These will appear in a dedicated section of the agreement.
                </p>
                <textarea
                  v-model="formData.specialClauses"
                  rows="8"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  placeholder="e.g., No smoking in the property. Tenant must maintain garden. Professional cleaning required at end of tenancy."
                ></textarea>
              </div>

            </div>

            <!-- Preview Step -->
            <div v-if="currentStep === 'preview'" class="space-y-4">
              <div v-if="generatedAgreement" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- PDF Preview -->
                <div class="lg:col-span-2 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                  <div class="p-3 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                    <span class="text-sm font-medium text-gray-700 dark:text-slate-300">Agreement Document</span>
                    <a
                      v-if="generatedAgreement.pdf_url"
                      :href="generatedAgreement.pdf_url"
                      target="_blank"
                      class="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <Download class="w-4 h-4" />
                      Download
                    </a>
                  </div>
                  <iframe
                    v-if="generatedAgreement.pdf_url"
                    :src="generatedAgreement.pdf_url"
                    class="w-full h-[500px] border-0"
                  ></iframe>
                  <div v-else class="h-[500px] flex items-center justify-center bg-gray-50 dark:bg-slate-800">
                    <div class="text-center">
                      <FileText class="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
                      <p class="text-gray-500 dark:text-slate-400">PDF not yet generated</p>
                    </div>
                  </div>
                </div>

                <!-- Recipients Panel -->
                <div class="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Recipients</h4>
                  <p class="text-xs text-gray-500 dark:text-slate-400 mb-4">
                    These parties will receive an email with a secure link to sign the agreement. Click an email to edit.
                  </p>
                  <div class="space-y-2">
                    <div
                      v-for="(landlord, i) in formData.landlords"
                      :key="'r-ll-' + i"
                      class="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg"
                    >
                      <div class="flex items-center gap-2">
                        <User class="w-4 h-4 text-blue-600" />
                        <span class="text-sm font-medium text-gray-900 dark:text-white">{{ landlord.name || 'Landlord ' + (i + 1) }}</span>
                      </div>
                      <div class="ml-6">
                        <input
                          v-model="landlord.email"
                          type="email"
                          placeholder="Enter email address"
                          class="w-full text-xs px-2 py-1 border border-transparent hover:border-gray-300 dark:hover:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary rounded bg-transparent dark:bg-transparent text-gray-600 dark:text-slate-400 focus:text-gray-900 dark:focus:text-white"
                          :class="{ 'border-red-300 dark:border-red-700': landlord.email && !isValidEmail(landlord.email) }"
                        />
                      </div>
                    </div>
                    <div
                      v-for="(tenant, i) in formData.tenants"
                      :key="'r-t-' + i"
                      class="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg"
                    >
                      <div class="flex items-center gap-2">
                        <User class="w-4 h-4 text-green-600" />
                        <span class="text-sm font-medium text-gray-900 dark:text-white">{{ tenant.name || 'Tenant ' + (i + 1) }}</span>
                      </div>
                      <div class="ml-6">
                        <input
                          v-model="tenant.email"
                          type="email"
                          placeholder="Enter email address"
                          class="w-full text-xs px-2 py-1 border border-transparent hover:border-gray-300 dark:hover:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary rounded bg-transparent dark:bg-transparent text-gray-600 dark:text-slate-400 focus:text-gray-900 dark:focus:text-white"
                          :class="{ 'border-red-300 dark:border-red-700': tenant.email && !isValidEmail(tenant.email) }"
                        />
                      </div>
                    </div>
                    <div
                      v-for="(guarantor, i) in formData.guarantors"
                      :key="'r-g-' + i"
                      class="p-2 bg-gray-50 dark:bg-slate-800 rounded-lg"
                    >
                      <div class="flex items-center gap-2">
                        <User class="w-4 h-4 text-purple-600" />
                        <span class="text-sm font-medium text-gray-900 dark:text-white">{{ guarantor.name || 'Guarantor ' + (i + 1) }}</span>
                      </div>
                      <div class="ml-6">
                        <input
                          v-model="guarantor.email"
                          type="email"
                          placeholder="Enter email address"
                          class="w-full text-xs px-2 py-1 border border-transparent hover:border-gray-300 dark:hover:border-slate-600 focus:border-primary focus:ring-1 focus:ring-primary rounded bg-transparent dark:bg-transparent text-gray-600 dark:text-slate-400 focus:text-gray-900 dark:focus:text-white"
                          :class="{ 'border-red-300 dark:border-red-700': guarantor.email && !isValidEmail(guarantor.email) }"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <button
                      @click="sendForSigning"
                      :disabled="sendingForSigning || !canSendForSigning"
                      class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Send class="w-4 h-4" />
                      {{ sendingForSigning ? 'Sending...' : 'Send for Signing' }}
                    </button>
                    <p v-if="!canSendForSigning" class="text-xs text-amber-600 mt-2 text-center">
                      All parties must have valid email addresses
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="generating" class="flex flex-col items-center justify-center py-12">
              <Loader2 class="w-8 h-8 text-primary animate-spin mb-4" />
              <p class="text-gray-600 dark:text-slate-400">Generating agreement...</p>
            </div>

            <!-- Error State -->
            <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p class="text-sm font-medium text-red-800">Error</p>
                  <p class="text-sm text-red-700 mt-1">{{ error }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
            <button
              v-if="currentStep !== 'template' && currentStep !== 'preview'"
              @click="prevStep"
              type="button"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
            >
              Back
            </button>
            <div v-else></div>

            <div class="flex items-center gap-3">
              <button
                @click="handleClose"
                type="button"
                class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <div class="flex flex-col items-end gap-1">
                <button
                  v-if="currentStep !== 'preview'"
                  @click="nextStep"
                  :disabled="!canProceed || generating"
                  class="px-6 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span v-if="currentStep === 'clauses'">Generate Agreement</span>
                  <span v-else>Continue</span>
                  <ChevronRight class="w-4 h-4" />
                </button>
                <p v-if="currentStep === 'parties' && !canProceed" class="text-xs text-red-500 max-w-xs text-right">
                  {{ !validateLandlords ? 'Check landlord details' : !validateTenants ? 'Check tenant details' : !validateGuarantors ? 'Check guarantor details (email required)' : 'Check bank details' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Compliance Override Modal -->
  <ComplianceOverrideModal
    :show="showComplianceOverrideModal"
    :property-address="props.tenancy?.property_address || ''"
    :expired-types="expiredComplianceTypes"
    @close="showComplianceOverrideModal = false"
    @confirm="handleComplianceOverrideConfirm"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '@/stores/auth'
import { useAgreementForm } from '@/composables/useAgreementForm'
import {
  X, Check, ChevronRight, Loader2, AlertTriangle, FileText,
  Download, Send, User, Pencil
} from 'lucide-vue-next'
import AddressAutocomplete from '@/components/AddressAutocomplete.vue'
import ComplianceOverrideModal from '@/components/properties/ComplianceOverrideModal.vue'
import { API_URL } from '@/lib/apiUrl'
import { authFetch } from '@/lib/authFetch'

const props = defineProps<{
  show: boolean
  tenancy: any
  landlords?: any[]
  specialClauses?: string[]
  tenantAddresses?: Map<string, any>
  guarantorsData?: any[]
}>()

const emit = defineEmits<{
  close: []
  generated: [agreement: any]
  sent: []
}>()

const toast = useToast()
const authStore = useAuthStore()
// Steps
type StepKey = 'template' | 'details' | 'parties' | 'clauses' | 'preview'
const steps: { key: StepKey; label: string }[] = [
  { key: 'template', label: 'Template' },
  { key: 'details', label: 'Details' },
  { key: 'parties', label: 'Parties' },
  { key: 'clauses', label: 'Clauses' }
]

const currentStep = ref<StepKey | 'preview'>('template')
const generating = ref(false)
const sendingForSigning = ref(false)
const error = ref<string | null>(null)
const generatedAgreement = ref<any>(null)
const showComplianceOverrideModal = ref(false)
const expiredComplianceTypes = ref<string[]>([])
const complianceOverrideReason = ref<string | null>(null)

// Track which addresses are being edited
const editingLandlordAddress = ref<number | null>(null)
const editingTenantAddress = ref<number | null>(null)
const editingGuarantorAddress = ref<number | null>(null)
const addressSearchQuery = ref('')

// Use the shared composable
const {
  formData,
  templateOptions,
  agreementTypeOptions,
  utilityOptions,
  isAPTA,
  depositSchemeOptions,
  rentDueDayOptions,
  generatedBreakClause,
  validateLandlords,
  validateTenants,
  validateGuarantors,
  isValidEmail,
  addLandlord,
  removeLandlord,
  addTenant,
  removeTenant,
  addGuarantor,
  removeGuarantor,
  getRequestData,
  prefillFromTenancy
} = useAgreementForm()

// Company details for managed properties (includes name, address, and bank details)
const companyDetails = ref<{
  name: string
  addressLine1: string
  addressLine2: string
  city: string
  postcode: string
  accountName: string
  accountNumber: string
  sortCode: string
} | null>(null)

// Alias for backward compatibility
const companyBankDetails = companyDetails

// Landlord bank details backup for let_only
const landlordBankDetails = ref<{
  accountName: string
  accountNumber: string
  sortCode: string
} | null>(null)

// Fetch company details (name, address, and bank details)
// Uses the tenancy's company_id to ensure we get the correct branch's details
const fetchCompanyDetails = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    // Use tenancy's company_id to fetch the correct company's details
    // This ensures we get the correct branch's agency details for the agreement
    const tenancyCompanyId = props.tenancy?.company_id
    console.log('[AgreementModal] fetchCompanyDetails:', {
      tenancyId: props.tenancy?.id,
      tenancyCompanyId,
      activeBranchId: localStorage.getItem('activeBranchId')
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // CRITICAL: Use tenancy's company_id, NOT the user's active branch
    if (tenancyCompanyId) {
      headers['X-Branch-Id'] = tenancyCompanyId
    }

    const response = await authFetch(`${API_URL}/api/company`, {
      token,
      headers
    })

    if (response.ok) {
      const data = await response.json()
      if (data.company) {
        companyDetails.value = {
          name: data.company.name || '',
          addressLine1: data.company.address || '',  // API returns 'address' not 'address_line1'
          addressLine2: '',  // Company doesn't have separate address_line2
          city: data.company.city || '',
          postcode: data.company.postcode || '',
          accountName: data.company.bank_account_name || '',
          accountNumber: data.company.bank_account_number || '',
          sortCode: data.company.bank_sort_code || ''
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch company details:', err)
  }
}

// Alias for backward compatibility
const fetchCompanyBankDetails = fetchCompanyDetails

// Watch for management type changes to update bank details accordingly
watch(() => formData.value.managementType, (newType) => {
  if (newType === 'managed' && companyBankDetails.value) {
    // Use company/agency bank details for managed properties
    formData.value.bankAccountName = companyBankDetails.value.accountName
    formData.value.bankAccountNumber = companyBankDetails.value.accountNumber
    formData.value.bankSortCode = companyBankDetails.value.sortCode
  } else if (newType === 'let_only') {
    // Use landlord bank details for let_only properties
    // First check if landlordBankDetails has values, otherwise check the first landlord
    const primaryLandlord = formData.value.landlords[0]
    if (landlordBankDetails.value && (landlordBankDetails.value.accountName || landlordBankDetails.value.accountNumber)) {
      formData.value.bankAccountName = landlordBankDetails.value.accountName
      formData.value.bankAccountNumber = landlordBankDetails.value.accountNumber
      formData.value.bankSortCode = landlordBankDetails.value.sortCode
    } else if (primaryLandlord) {
      formData.value.bankAccountName = primaryLandlord.bankAccountName || ''
      formData.value.bankAccountNumber = primaryLandlord.bankAccountNumber || ''
      formData.value.bankSortCode = primaryLandlord.bankSortCode || ''
    }
  }
})

// Sync form-level bank details to first landlord for data consistency
watch(
  () => ({
    name: formData.value.bankAccountName,
    number: formData.value.bankAccountNumber,
    sort: formData.value.bankSortCode
  }),
  (newDetails) => {
    if (formData.value.managementType === 'let_only' && formData.value.landlords[0]) {
      // Keep landlord data in sync with form-level bank details
      formData.value.landlords[0].bankAccountName = newDetails.name || ''
      formData.value.landlords[0].bankAccountNumber = newDetails.number || ''
      formData.value.landlords[0].bankSortCode = newDetails.sort || ''
      // Update backup
      landlordBankDetails.value = {
        accountName: newDetails.name || '',
        accountNumber: newDetails.number || '',
        sortCode: newDetails.sort || ''
      }
    }
  },
  { deep: true }
)

// Step descriptions
const stepDescription = computed(() => {
  switch (currentStep.value) {
    case 'template': return 'Choose the agreement type and deposit scheme'
    case 'details': return 'Review and adjust tenancy dates and financials'
    case 'parties': return 'Verify parties, management type, and payment details'
    case 'clauses': return 'Add break clause and special clauses'
    case 'preview': return 'Review the generated agreement and send for signing'
    default: return ''
  }
})

// Step class for progress indicator
const getStepClass = (stepKey: StepKey) => {
  const stepIndex = steps.findIndex(s => s.key === stepKey)
  const currentIndex = steps.findIndex(s => s.key === currentStep.value)

  if (currentStep.value === 'preview') return 'bg-green-500 text-white'
  if (stepIndex < currentIndex) return 'bg-green-500 text-white'
  if (stepKey === currentStep.value) return 'bg-primary text-white'
  return 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
}

const isStepComplete = (stepKey: StepKey) => {
  const stepIndex = steps.findIndex(s => s.key === stepKey)
  const currentIndex = steps.findIndex(s => s.key === currentStep.value)
  return currentStep.value === 'preview' || stepIndex < currentIndex
}

// Can proceed validation
const canProceed = computed(() => {
  switch (currentStep.value) {
    case 'template':
      return !!formData.value.templateType && !!formData.value.depositSchemeType
    case 'details':
      return !!(
        formData.value.tenancyStartDate &&
        formData.value.rentAmount &&
        formData.value.rentAmount > 0 &&
        formData.value.depositAmount !== undefined &&
        formData.value.depositAmount >= 0
      )
    case 'parties': {
      // Parties validation plus bank details for let_only
      const partiesValid = validateLandlords.value && validateTenants.value && validateGuarantors.value
      if (formData.value.managementType === 'let_only') {
        return partiesValid && !!(
          formData.value.bankAccountName &&
          formData.value.bankAccountNumber &&
          formData.value.bankSortCode
        )
      }
      return partiesValid
    }
    case 'clauses':
      return true
    default:
      return true
  }
})

// Can send for signing
const canSendForSigning = computed(() => {
  // All landlords must have email
  const landlordsValid = formData.value.landlords.every(l => l.email && isValidEmail(l.email))
  // At least lead tenant must have email (or all tenants)
  const tenantsValid = formData.value.tenants.some(t => t.email && isValidEmail(t.email))
  // All guarantors must have email (or no guarantors)
  const guarantorsValid = formData.value.guarantors.length === 0 ||
    formData.value.guarantors.every(g => g.email && isValidEmail(g.email))

  return landlordsValid && tenantsValid && guarantorsValid
})

// Format address helper
const formatAddress = (addr: any) => {
  if (!addr) return ''
  const parts = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean)
  return parts.join(', ')
}

// Address selection handlers
const handleLandlordAddressSelected = (index: number, addr: any) => {
  const landlord = formData.value.landlords[index]
  if (!landlord) return
  landlord.address = {
    line1: addr.addressLine1 || '',
    line2: addr.addressLine2 || '',
    city: addr.city || '',
    postcode: addr.postcode || ''
  }
  editingLandlordAddress.value = null
}

const handleTenantAddressSelected = (index: number, addr: any) => {
  const tenant = formData.value.tenants[index]
  if (!tenant) return
  tenant.address = {
    line1: addr.addressLine1 || '',
    line2: addr.addressLine2 || '',
    city: addr.city || '',
    postcode: addr.postcode || ''
  }
  editingTenantAddress.value = null
}

const handleGuarantorAddressSelected = (index: number, addr: any) => {
  const guarantor = formData.value.guarantors[index]
  if (!guarantor) return
  guarantor.address = {
    line1: addr.addressLine1 || '',
    line2: addr.addressLine2 || '',
    city: addr.city || '',
    postcode: addr.postcode || ''
  }
  editingGuarantorAddress.value = null
}

// Navigation
const nextStep = async () => {
  const stepOrder: (StepKey | 'preview')[] = ['template', 'details', 'parties', 'clauses', 'preview']
  const currentIndex = stepOrder.indexOf(currentStep.value)

  if (currentStep.value === 'clauses') {
    // Generate agreement
    await generateAgreement()
  } else if (currentIndex < stepOrder.length - 1) {
    currentStep.value = stepOrder[currentIndex + 1] as StepKey
  }
}

const prevStep = () => {
  const stepOrder: (StepKey | 'preview')[] = ['template', 'details', 'parties', 'clauses', 'preview']
  const currentIndex = stepOrder.indexOf(currentStep.value)
  if (currentIndex > 0) {
    currentStep.value = stepOrder[currentIndex - 1] as StepKey
  }
}

// Generate agreement
// Handle compliance override confirmation - retry agreement generation
function handleComplianceOverrideConfirm(reason: string) {
  complianceOverrideReason.value = reason
  showComplianceOverrideModal.value = false
  toast.success('Compliance override acknowledged')
  // Retry generation with the override
  generateAgreement()
}

const generateAgreement = async () => {
  generating.value = true
  error.value = null

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Build request data
    const requestData: Record<string, any> = {
      ...getRequestData(),
      tenancyId: props.tenancy?.id,
      propertyId: props.tenancy?.property_id
    }

    // Include compliance override if user has acknowledged
    if (complianceOverrideReason.value) {
      requestData.complianceOverride = {
        acknowledged: true,
        reason: complianceOverrideReason.value
      }
    }

    console.log('[TenancyAgreementModal] Request data being sent:')
    console.log('  breakClause:', (requestData as any).breakClause ? `"${(requestData as any).breakClause.substring(0, 80)}..."` : 'NONE')
    console.log('  specialClauses:', (requestData as any).specialClauses ? `"${(requestData as any).specialClauses.substring(0, 80)}..."` : 'NONE')
    console.log('  formData.breakClause:', formData.value.breakClause ? `"${formData.value.breakClause.substring(0, 80)}..."` : 'NONE')
    console.log('  formData.breakClauseEnabled:', formData.value.breakClauseEnabled)

    // Create agreement
    const createResponse = await authFetch(`${API_URL}/api/agreements`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json()

      // Handle compliance override required
      if (errorData.requiresComplianceOverride && errorData.expiredComplianceTypes) {
        expiredComplianceTypes.value = errorData.expiredComplianceTypes
        showComplianceOverrideModal.value = true
        generating.value = false
        return
      }

      throw new Error(errorData.error || 'Failed to create agreement')
    }

    const { agreement } = await createResponse.json()

    // Generate PDF
    const generateResponse = await authFetch(`${API_URL}/api/agreements/${agreement.id}/generate`, {
      method: 'POST',
      token
    })

    if (!generateResponse.ok) {
      const errorData = await generateResponse.json()
      if (generateResponse.status === 402) {
        throw new Error(errorData.message || 'Insufficient credits to generate agreement')
      }
      throw new Error(errorData.error || 'Failed to generate agreement PDF')
    }

    const { agreementId } = await generateResponse.json()

    // Fetch the full agreement with PDF URL
    const fetchResponse = await authFetch(`${API_URL}/api/agreements/${agreementId || agreement.id}`, {
      token
    })

    if (fetchResponse.ok) {
      const data = await fetchResponse.json()
      generatedAgreement.value = data.agreement
    } else {
      generatedAgreement.value = agreement
    }

    currentStep.value = 'preview'
    emit('generated', generatedAgreement.value)
    toast.success('Agreement generated successfully')

  } catch (err: any) {
    error.value = err.message || 'Failed to generate agreement'
    toast.error(error.value)
  } finally {
    generating.value = false
  }
}

// Send for signing
const sendForSigning = async () => {
  if (!generatedAgreement.value?.id) return

  sendingForSigning.value = true
  error.value = null

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(`${API_URL}/api/agreements/${generatedAgreement.value.id}/send-for-signing`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to send for signing')
    }

    toast.success('Agreement sent for signing')
    emit('sent')
    handleClose()

  } catch (err: any) {
    error.value = err.message || 'Failed to send for signing'
    toast.error(error.value)
  } finally {
    sendingForSigning.value = false
  }
}

// Close handler
const handleClose = () => {
  currentStep.value = 'template'
  error.value = null
  generatedAgreement.value = null
  emit('close')
}

const handleBackdropClick = () => {
  // Don't close on backdrop click if generating
  if (!generating.value && !sendingForSigning.value) {
    handleClose()
  }
}

// Prefill from tenancy when modal opens
watch(() => props.show, async (show) => {
  if (show && props.tenancy) {
    prefillFromTenancy(props.tenancy, {
      landlords: props.landlords,
      specialClauses: props.specialClauses,
      tenantAddresses: props.tenantAddresses,
      guarantorsData: props.guarantorsData
    })

    // Store landlord bank details as backup for let_only mode
    const primaryLandlord = formData.value.landlords[0]
    if (primaryLandlord) {
      landlordBankDetails.value = {
        accountName: primaryLandlord.bankAccountName || formData.value.bankAccountName || '',
        accountNumber: primaryLandlord.bankAccountNumber || formData.value.bankAccountNumber || '',
        sortCode: primaryLandlord.bankSortCode || formData.value.bankSortCode || ''
      }
    }

    // Fetch company bank details for managed mode
    await fetchCompanyBankDetails()

    // If management type is managed, populate with company bank details
    if (formData.value.managementType === 'managed' && companyBankDetails.value) {
      formData.value.bankAccountName = companyBankDetails.value.accountName
      formData.value.bankAccountNumber = companyBankDetails.value.accountNumber
      formData.value.bankSortCode = companyBankDetails.value.sortCode
    }

    currentStep.value = 'template'
    error.value = null
    generatedAgreement.value = null
  }
})

// Initial prefill if modal is already showing
onMounted(async () => {
  if (props.show && props.tenancy) {
    prefillFromTenancy(props.tenancy, {
      landlords: props.landlords,
      specialClauses: props.specialClauses,
      tenantAddresses: props.tenantAddresses,
      guarantorsData: props.guarantorsData
    })

    // Store landlord bank details as backup
    const primaryLandlord = formData.value.landlords[0]
    if (primaryLandlord) {
      landlordBankDetails.value = {
        accountName: primaryLandlord.bankAccountName || formData.value.bankAccountName || '',
        accountNumber: primaryLandlord.bankAccountNumber || formData.value.bankAccountNumber || '',
        sortCode: primaryLandlord.bankSortCode || formData.value.bankSortCode || ''
      }
    }

    // Fetch company bank details
    await fetchCompanyBankDetails()

    // If management type is managed, populate with company bank details
    if (formData.value.managementType === 'managed' && companyBankDetails.value) {
      formData.value.bankAccountName = companyBankDetails.value.accountName
      formData.value.bankAccountNumber = companyBankDetails.value.accountNumber
      formData.value.bankSortCode = companyBankDetails.value.sortCode
    }
  }
})
</script>

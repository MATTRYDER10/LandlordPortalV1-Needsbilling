<template>
  <div class="p-8">
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-gray-900">Generate AST Agreement</h2>
      <p class="mt-2 text-gray-600">Create an Assured Shorthold Tenancy Agreement</p>
    </div>

      <!-- Progress Steps -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div v-for="(step, index) in steps" :key="index" class="flex-1">
            <div class="flex items-center">
              <div class="flex items-center flex-col">
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors"
                  :class="
                    currentStep > index
                      ? 'bg-green-500 text-white'
                      : currentStep === index
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-600'
                  "
                >
                  <Check v-if="currentStep > index" class="w-6 h-6" />
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <span class="text-xs mt-2 text-center font-medium" :class="currentStep === index ? 'text-primary' : 'text-gray-600'">{{ step }}</span>
              </div>
              <div v-if="index < steps.length - 1" class="flex-1 h-0.5 mx-4" :class="currentStep > index ? 'bg-green-500' : 'bg-gray-200'"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Imported From Reference Banner -->
      <div v-if="importedFromReference && selectedReferenceId" class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div class="flex items-center">
          <FileText class="w-5 h-5 text-blue-600 mr-2" />
          <span class="text-sm font-medium text-blue-900">Imported from Reference #{{ selectedReferenceId }}</span>
        </div>
        <button
          @click="clearImport"
          type="button"
          class="text-sm text-blue-700 hover:text-blue-900 font-medium"
        >
          Clear Import
        </button>
      </div>

      <!-- Imported From Landlord Banner -->
      <div v-if="importedFromLandlord && selectedLandlordId" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center justify-between">
        <div class="flex items-center">
          <Users class="w-5 h-5 text-green-600 mr-2" />
          <span class="text-sm font-medium text-green-900">Imported landlord details and bank information</span>
        </div>
        <button
          @click="clearLandlordImport"
          type="button"
          class="text-sm text-green-700 hover:text-green-900 font-medium"
        >
          Clear Import
        </button>
      </div>

      <!-- Form Container -->
      <div class="bg-white rounded-lg shadow p-6">
        <!-- Step 0: Import from Reference or Landlord -->
        <div v-if="currentStep === 0">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Import Data (Optional)</h3>
          <p class="text-sm text-gray-600 mb-6">Pre-fill this agreement with data from a completed reference or landlord, or skip to enter manually</p>

          <!-- Toggle Buttons -->
          <div class="mb-6 flex gap-3 flex-wrap">
            <button
              @click="toggleReferenceSelector"
              type="button"
              class="px-6 py-3 text-sm font-medium rounded-md transition-colors"
              :class="importedFromReference
                ? 'bg-green-600 text-white hover:bg-green-700'
                : showReferenceSelector
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              "
            >
              {{ importedFromReference ? '✓ Reference Imported' : 'Import from Reference' }}
            </button>
            <button
              @click="toggleLandlordImportSelector"
              type="button"
              class="px-6 py-3 text-sm font-medium rounded-md transition-colors"
              :class="importedFromLandlord
                ? 'bg-green-600 text-white hover:bg-green-700'
                : showLandlordImportSelector
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              "
            >
              {{ importedFromLandlord ? '✓ Landlord Imported' : 'Import from Landlord' }}
            </button>
            <button
              v-if="showReferenceSelector || showLandlordImportSelector"
              @click="closeAllImportSelectors"
              type="button"
              class="px-6 py-3 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Close All
            </button>
          </div>

          <!-- Reference Selector -->
          <div v-if="showReferenceSelector" class="space-y-4">
            <!-- Search and Filter -->
            <div class="flex gap-4">
              <div class="flex-1">
                <input
                  v-model="referenceSearchQuery"
                  type="text"
                  placeholder="Search by tenant name or property address..."
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <button
                @click="fetchParentReferences"
                type="button"
                :disabled="loadingReferences"
                class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {{ loadingReferences ? 'Loading...' : 'Search' }}
              </button>
            </div>

            <!-- Loading State -->
            <div v-if="loadingReferences" class="text-center py-12">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p class="mt-2 text-gray-600">Loading references...</p>
            </div>

            <!-- No References -->
            <div v-else-if="!loadingReferences && filteredReferences.length === 0" class="text-center py-12">
              <FileText class="mx-auto h-12 w-12 text-gray-400" />
              <p class="mt-2 text-gray-600">{{ referenceSearchQuery ? 'No references match your search' : 'No completed references found. Click "Skip" to enter manually.' }}</p>
            </div>

            <!-- Reference Cards -->
            <div v-else class="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
              <div
                v-for="reference in filteredReferences"
                :key="reference.id"
                @click="selectReference(reference.id)"
                class="border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md"
                :class="
                  selectedReferenceId === reference.id
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-primary/50'
                "
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <h4 class="font-semibold text-gray-900">
                        {{ reference.tenant_first_name }} {{ reference.tenant_last_name }}
                      </h4>
                      <span v-if="reference.is_group_parent" class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        {{ reference.tenant_count || 0 }} Tenants
                      </span>
                      <span class="px-2 py-0.5 text-xs font-medium rounded" :class="{
                        'bg-green-100 text-green-800': reference.status === 'completed',
                        'bg-yellow-100 text-yellow-800': reference.status === 'pending_verification',
                        'bg-gray-100 text-gray-800': reference.status !== 'completed' && reference.status !== 'pending_verification'
                      }">
                        {{ reference.status }}
                      </span>
                    </div>
                    <p class="text-sm text-gray-600 mb-1">
                      {{ reference.property_address }}, {{ reference.property_city }} {{ reference.property_postcode }}
                    </p>
                    <div class="flex items-center gap-4 text-sm text-gray-500">
                      <span>Rent: £{{ reference.monthly_rent || 'N/A' }}/mo</span>
                      <span v-if="reference.move_in_date">Move-in: {{ formatUkDate(reference.move_in_date, { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>
                    </div>
                  </div>
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    :class="
                      selectedReferenceId === reference.id
                        ? 'border-primary bg-primary'
                        : 'border-gray-300'
                    "
                  >
                    <div v-if="selectedReferenceId === reference.id" class="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Landlord Selector for Import -->
          <div v-if="showLandlordImportSelector" class="space-y-4">
            <!-- Search -->
            <div class="flex gap-4">
              <div class="flex-1">
                <input
                  v-model="landlordImportSearchQuery"
                  type="text"
                  placeholder="Search by landlord name or email..."
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <button
                @click="fetchLandlordsForImport"
                type="button"
                :disabled="loadingLandlordsImport"
                class="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {{ loadingLandlordsImport ? 'Loading...' : 'Search' }}
              </button>
            </div>

            <!-- Loading State -->
            <div v-if="loadingLandlordsImport" class="text-center py-12">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p class="mt-2 text-gray-600">Loading landlords...</p>
            </div>

            <!-- No Landlords -->
            <div v-else-if="!loadingLandlordsImport && filteredLandlordsForImport.length === 0" class="text-center py-12">
              <Users class="mx-auto h-12 w-12 text-gray-400" />
              <p class="mt-2 text-gray-600">{{ landlordImportSearchQuery ? 'No landlords match your search' : 'No landlords found. Click "Skip" to enter manually.' }}</p>
            </div>

            <!-- Landlord Cards -->
            <div v-else class="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
              <div
                v-for="landlord in filteredLandlordsForImport"
                :key="landlord.id"
                @click="selectLandlordForImport(landlord)"
                class="border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md"
                :class="
                  selectedLandlordId === landlord.id
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-primary/50'
                "
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <h4 class="font-semibold text-gray-900">
                        {{ landlord.first_name }} {{ landlord.last_name }}
                      </h4>
                      <span v-if="landlord.bank_details?.account_number" class="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
                        Bank Details Available
                      </span>
                    </div>
                    <p class="text-sm text-gray-600 mb-1">{{ landlord.email }}</p>
                    <p v-if="landlord.residential_address?.line1" class="text-sm text-gray-500">
                      {{ landlord.residential_address.line1 }}, {{ landlord.residential_address.city }} {{ landlord.residential_address.postcode }}
                    </p>
                  </div>
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    :class="
                      selectedLandlordId === landlord.id
                        ? 'border-primary bg-primary'
                        : 'border-gray-300'
                    "
                  >
                    <div v-if="selectedLandlordId === landlord.id" class="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 1: Select Template -->
        <div v-if="currentStep === 1">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Select Agreement Template</h3>
          <p class="text-sm text-gray-600 mb-6">Choose the contract language and deposit protection scheme for this tenancy</p>

          <!-- Language Selection -->
          <div class="mb-8">
            <label class="block text-sm font-medium text-gray-700 mb-3">Contract Language *</label>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <button
                type="button"
                @click="formData.language = 'english'"
                class="border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md text-left"
                :class="
                  formData.language === 'english'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-primary/50'
                "
              >
                <div class="flex items-center">
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    :class="
                      formData.language === 'english'
                        ? 'border-primary bg-primary'
                        : 'border-gray-300'
                    "
                  >
                    <div v-if="formData.language === 'english'" class="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <div class="ml-3">
                    <h4 class="font-semibold text-gray-900">English</h4>
                    <p class="text-sm text-gray-600">Assured Shorthold Tenancy (AST)</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                @click="formData.language = 'welsh'"
                class="border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md text-left"
                :class="
                  formData.language === 'welsh'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 hover:border-primary/50'
                "
              >
                <div class="flex items-center">
                  <div
                    class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    :class="
                      formData.language === 'welsh'
                        ? 'border-primary bg-primary'
                        : 'border-gray-300'
                    "
                  >
                    <div v-if="formData.language === 'welsh'" class="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <div class="ml-3">
                    <h4 class="font-semibold text-gray-900">Cymraeg (Welsh)</h4>
                    <p class="text-sm text-gray-600">Welsh Occupation Contract</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Deposit Scheme Selection -->
          <label class="block text-sm font-medium text-gray-700 mb-3">Deposit Protection Scheme *</label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="template in templateOptions"
              :key="template.value"
              @click="formData.templateType = template.value"
              class="border-2 rounded-lg p-6 cursor-pointer transition-all hover:shadow-md"
              :class="
                formData.templateType === template.value
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-primary/50'
              "
            >
              <div class="flex items-start">
                <div
                  class="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0"
                  :class="
                    formData.templateType === template.value
                      ? 'border-primary bg-primary'
                      : 'border-gray-300'
                  "
                >
                  <div v-if="formData.templateType === template.value" class="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div class="ml-3">
                  <h4 class="font-semibold text-gray-900">{{ template.label }}</h4>
                  <p class="text-sm text-gray-600 mt-1">{{ template.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Deposit Scheme Type - only show for schemes that need it -->
          <div v-if="formData.templateType !== 'no_deposit' && formData.templateType !== 'reposit'" class="mt-6">
            <label class="block text-sm font-medium text-gray-700 mb-1">Deposit Scheme Type *</label>
            <select
              v-model="formData.depositSchemeType"
              :required="formData.templateType !== 'no_deposit' && formData.templateType !== 'reposit'"
              class="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            >
              <option value="" disabled>Please Select</option>
              <option value="Custodial">Custodial Scheme</option>
              <option value="Insured">Insured Scheme</option>
            </select>
            <p class="text-xs text-gray-500 mt-1">Custodial: Deposit held by scheme. Insured: You hold deposit as stakeholder.</p>
          </div>
        </div>

        <!-- Step 2: Property Address -->
        <div v-if="currentStep === 2">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Property Address</h3>

          <!-- Entry Mode Toggle -->
          <div class="mb-6 flex gap-3">
            <button
              @click="propertyEntryMode = 'select'; fetchProperties()"
              type="button"
              class="px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2"
              :class="propertyEntryMode === 'select'
                ? 'bg-primary text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              "
            >
              <Building class="w-4 h-4" />
              Select from Properties
            </button>
            <button
              @click="propertyEntryMode = 'manual'; clearPropertySelection()"
              type="button"
              class="px-4 py-2 text-sm font-medium rounded-md transition-colors"
              :class="propertyEntryMode === 'manual'
                ? 'bg-primary text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              "
            >
              Enter Manually
            </button>
          </div>

          <!-- Selected Property Banner -->
          <div v-if="selectedPropertyId && propertyEntryMode === 'select'" class="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
            <div class="flex items-center">
              <Building class="w-5 h-5 text-green-600 mr-2" />
              <span class="text-sm font-medium text-green-900">{{ selectedPropertyAddress }}</span>
              <span v-if="complianceOverrideReason" class="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">Compliance Override</span>
            </div>
            <button
              @click="clearPropertySelection"
              type="button"
              class="text-sm text-green-700 hover:text-green-900 font-medium"
            >
              Clear
            </button>
          </div>

          <!-- Property Selector -->
          <div v-if="propertyEntryMode === 'select' && !selectedPropertyId" class="mb-6 space-y-4">
            <div class="flex gap-4">
              <div class="flex-1">
                <input
                  v-model="propertySearchQuery"
                  type="text"
                  placeholder="Search by address or postcode..."
                  class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
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
            <div v-if="loadingProperties" class="text-center py-8">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p class="mt-2 text-gray-600">Loading properties...</p>
            </div>

            <!-- No Properties -->
            <div v-else-if="!loadingProperties && availableProperties.length === 0" class="text-center py-8">
              <Building class="mx-auto h-12 w-12 text-gray-400" />
              <p class="mt-2 text-gray-600">{{ propertySearchQuery ? 'No properties match your search' : 'No properties found. Add properties in the Properties module or enter address manually.' }}</p>
            </div>

            <!-- Property Cards -->
            <div v-else class="grid grid-cols-1 gap-3 max-h-72 overflow-y-auto">
              <div
                v-for="property in availableProperties"
                :key="property.id"
                @click="selectProperty(property)"
                class="border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h4 class="font-medium text-gray-900">
                      {{ property.address_line1 }}
                    </h4>
                    <p class="text-sm text-gray-600">
                      {{ property.city }}, {{ property.postcode }}
                    </p>
                    <div class="flex items-center gap-2 mt-2">
                      <span v-if="property.status" class="px-2 py-0.5 text-xs rounded" :class="{
                        'bg-green-100 text-green-800': property.status === 'vacant',
                        'bg-blue-100 text-blue-800': property.status === 'in_tenancy'
                      }">
                        {{ property.status === 'in_tenancy' ? 'In Tenancy' : 'Vacant' }}
                      </span>
                      <span v-if="property.compliance_status === 'expired'" class="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">
                        Compliance Expired
                      </span>
                    </div>
                  </div>
                  <div class="ml-4 text-primary">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Manual Entry Form -->
          <div v-if="propertyEntryMode === 'manual' || selectedPropertyId" class="space-y-4 max-w-2xl">
            <AddressAutocomplete
              v-model="formData.propertyAddress.line1"
              label="Property Address"
              :required="true"
              placeholder="Start typing the property address..."
              :disabled="!!selectedPropertyId"
              @addressSelected="handlePropertyAddressSelected"
            />
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input
                v-model="formData.propertyAddress.line2"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Apartment, suite, etc. (optional)"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  v-model="formData.propertyAddress.city"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">County</label>
                <input
                  v-model="formData.propertyAddress.county"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
              <input
                v-model="formData.propertyAddress.postcode"
                type="text"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="SW1A 1AA"
              />
            </div>
          </div>
        </div>

        <!-- Step 3: Agreement Details -->
        <div v-if="currentStep === 3">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Agreement Details</h3>
          <div class="space-y-4 max-w-2xl">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Rent Amount *</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">£</span>
                  <input
                    v-model.number="formData.rentAmount"
                    type="number"
                    step="0.01"
                    required
                    class="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Deposit Amount *</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500">£</span>
                  <input
                    v-model.number="formData.depositAmount"
                    type="number"
                    step="0.01"
                    required
                    class="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="0.00"
                    @input="depositManuallyEdited = true"
                  />
                </div>
                <p v-if="!depositManuallyEdited && calculatedDeposit" class="text-xs text-blue-600 mt-1">
                  Auto-calculated as 5 weeks rent
                </p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tenancy Start Date *</label>
                <input
                  v-model="formData.tenancyStartDate"
                  type="date"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tenancy Term *</label>
                <div class="flex items-center gap-3">
                  <input
                    v-model.number="formData.tenancyTerm"
                    type="number"
                    min="0"
                    step="1"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="e.g. 6, 12"
                  />
                  <span class="text-sm text-gray-600 whitespace-nowrap">months</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Enter 0 for rolling (month-to-month)</p>
              </div>
            </div>

            <div v-if="Number(formData.tenancyTerm) !== 0">
              <label class="block text-sm font-medium text-gray-700 mb-1">Tenancy End Date</label>
              <input
                v-model="formData.tenancyEndDate"
                type="date"
                :min="formData.tenancyStartDate"
                :disabled="!formData.tenancyStartDate"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p v-if="isEndDateOverridden" class="text-xs text-amber-600 mt-1">
                Custom end date (calculated: {{ displayCalculatedEndDate }})
              </p>
              <p v-else class="text-xs text-gray-500 mt-1">
                Auto-calculated from start date + term. Edit for non-standard terms.
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Rent Due Date *</label>
              <select
                v-model="formData.rentDueDay"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="1st">1st of each month</option>
                <option value="2nd">2nd of each month</option>
                <option value="3rd">3rd of each month</option>
                <option value="4th">4th of each month</option>
                <option value="5th">5th of each month</option>
                <option value="6th">6th of each month</option>
                <option value="7th">7th of each month</option>
                <option value="8th">8th of each month</option>
                <option value="9th">9th of each month</option>
                <option value="10th">10th of each month</option>
                <option value="11th">11th of each month</option>
                <option value="12th">12th of each month</option>
                <option value="13th">13th of each month</option>
                <option value="14th">14th of each month</option>
                <option value="15th">15th of each month</option>
                <option value="16th">16th of each month</option>
                <option value="17th">17th of each month</option>
                <option value="18th">18th of each month</option>
                <option value="19th">19th of each month</option>
                <option value="20th">20th of each month</option>
                <option value="21st">21st of each month</option>
                <option value="22nd">22nd of each month</option>
                <option value="23rd">23rd of each month</option>
                <option value="24th">24th of each month</option>
                <option value="25th">25th of each month</option>
                <option value="26th">26th of each month</option>
                <option value="27th">27th of each month</option>
                <option value="28th">28th of each month</option>
                <option value="29th">29th of each month</option>
                <option value="30th">30th of each month</option>
                <option value="Last">Last day of each month</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Permitted Occupier(s)</label>
              <input
                v-model="formData.permittedOccupiers"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Names of any permitted occupiers (optional)"
              />
              <p class="text-xs text-gray-500 mt-1">People allowed to live at the property but not named as tenants</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Management Type *</label>
              <select
                v-model="formData.managementType"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="managed">Fully Managed (Agent manages property)</option>
                <option value="let_only">Let Only (Landlord manages property)</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">Managed: Agent details used. Let Only: Landlord details used.</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tenant Email *</label>
              <input
                v-model="formData.tenantEmail"
                type="email"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="tenant@example.com"
              />
              <p class="text-xs text-gray-500 mt-1">Primary tenant's email address</p>
            </div>

            <div v-if="formData.managementType === 'let_only'">
              <label class="block text-sm font-medium text-gray-700 mb-1">Landlord Email *</label>
              <input
                v-model="formData.landlordEmail"
                type="email"
                :required="formData.managementType === 'let_only'"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="landlord@example.com"
              />
              <p class="text-xs text-gray-500 mt-1">First landlord's email address</p>
            </div>

            <div v-if="formData.managementType === 'let_only'">
              <h4 class="font-semibold text-gray-900 mt-6 mb-3">Landlord Bank Details</h4>
              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
                  <input
                    v-model="formData.bankAccountName"
                    type="text"
                    :required="formData.managementType === 'let_only'"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                    placeholder="Account holder name"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                    <input
                      v-model="formData.bankAccountNumber"
                      type="text"
                      :required="formData.managementType === 'let_only'"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="12345678"
                      maxlength="8"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Sort Code *</label>
                    <input
                      v-model="formData.bankSortCode"
                      type="text"
                      :required="formData.managementType === 'let_only'"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="12-34-56"
                      maxlength="8"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Break Clause</label>

              <div class="mb-3">
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    v-model="formData.breakClauseEnabled"
                    class="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span class="ml-2 text-sm text-gray-700">Include break clause in this tenancy</span>
                </label>
              </div>

              <div v-if="formData.breakClauseEnabled" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Break clause applies after (months) *</label>
                    <input
                      v-model.number="formData.breakClauseMonths"
                      type="number"
                      min="1"
                      :max="formData.tenancyTerm || 12"
                      required
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="e.g., 6"
                    />
                    <p class="text-xs text-gray-500 mt-1">Must be less than tenancy term</p>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Notice period required (months) *</label>
                    <input
                      v-model.number="formData.breakClauseNoticePeriod"
                      type="number"
                      min="1"
                      max="6"
                      required
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                      placeholder="e.g., 2"
                    />
                  </div>
                </div>

                <div v-if="generatedBreakClause" class="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <p class="text-xs font-medium text-gray-600 mb-1">Generated Legal Text:</p>
                  <p class="text-sm text-gray-800">{{ generatedBreakClause }}</p>
                </div>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Special Clauses</label>
              <textarea
                v-model="formData.specialClauses"
                rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                placeholder="Any special terms or conditions for this tenancy"
              ></textarea>
              <p class="text-xs text-gray-500 mt-1">Optional additional clauses (leave empty if not applicable)</p>
            </div>
          </div>
        </div>

        <!-- Step 4: Landlords -->
        <div v-if="currentStep === 4">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="text-xl font-semibold text-gray-900">Landlord Details</h3>
              <p class="text-sm text-gray-600 mt-1">Add up to 20 landlords for this agreement</p>
            </div>
            <button
              @click="showLandlordSelector = true"
              type="button"
              class="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
            >
              Select from Landlords
            </button>
          </div>

          <div v-for="(landlord, index) in formData.landlords" :key="'landlord-' + index" class="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div class="flex justify-between items-center mb-4">
              <h4 class="font-medium text-gray-900">Landlord {{ index + 1 }}</h4>
              <button
                v-if="formData.landlords.length > 1"
                @click="removeLandlord(index)"
                type="button"
                class="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  v-model="landlord.name"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                />
              </div>
              <AddressAutocomplete
                v-model="landlord.address.line1"
                label="Landlord Address"
                :required="true"
                :id="'landlord-address-' + index"
                placeholder="Start typing address..."
                @addressSelected="(addr) => handleLandlordAddressSelected(index, addr)"
              />
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input
                  v-model="landlord.address.line2"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    v-model="landlord.address.city"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                  <input
                    v-model="landlord.address.postcode"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            v-if="formData.landlords.length < 20"
            @click="addLandlord"
            type="button"
            class="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
          >
            + Add Another Landlord
          </button>
        </div>

        <!-- Step 5: Tenants -->
        <div v-if="currentStep === 5">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Tenant Details</h3>
          <p class="text-sm text-gray-600 mb-6">Add up to 20 tenants for this agreement</p>

          <div v-for="(tenant, index) in formData.tenants" :key="'tenant-' + index" class="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div class="flex justify-between items-center mb-4">
              <h4 class="font-medium text-gray-900">Tenant {{ index + 1 }}</h4>
              <button
                v-if="formData.tenants.length > 1"
                @click="removeTenant(index)"
                type="button"
                class="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  v-model="tenant.name"
                  type="text"
                  required
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                />
              </div>
              <AddressAutocomplete
                v-model="tenant.address.line1"
                label="Tenant Address"
                :required="true"
                :id="'tenant-address-' + index"
                placeholder="Start typing address..."
                @addressSelected="(addr) => handleTenantAddressSelected(index, addr)"
              />
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                <input
                  v-model="tenant.address.line2"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input
                    v-model="tenant.address.city"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                  <input
                    v-model="tenant.address.postcode"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            v-if="formData.tenants.length < 20"
            @click="addTenant"
            type="button"
            class="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
          >
            + Add Another Tenant
          </button>
        </div>

        <!-- Step 6: Guarantors -->
        <div v-if="currentStep === 6">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Guarantor Details (Optional)</h3>
          <p class="text-sm text-gray-600 mb-6">Add up to 20 guarantors for this agreement, or skip if none required</p>

          <div v-if="formData.guarantors.length === 0" class="text-center py-8">
            <p class="text-gray-500 mb-4">No guarantors added yet</p>
            <button
              @click="addGuarantor"
              type="button"
              class="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
            >
              + Add Guarantor
            </button>
          </div>

          <div v-else>
            <div v-for="(guarantor, index) in formData.guarantors" :key="'guarantor-' + index" class="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div class="flex justify-between items-center mb-4">
                <h4 class="font-medium text-gray-900">Guarantor {{ index + 1 }}</h4>
                <button
                  @click="removeGuarantor(index)"
                  type="button"
                  class="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Remove
                </button>
              </div>

              <div class="space-y-3">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    v-model="guarantor.name"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    v-model="guarantor.email"
                    type="email"
                    required
                    placeholder="guarantor@example.com"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                  <p class="mt-1 text-xs text-gray-500">Required for sending signing request</p>
                </div>
                <AddressAutocomplete
                  v-model="guarantor.address.line1"
                  label="Guarantor Address"
                  :required="true"
                  :id="'guarantor-address-' + index"
                  placeholder="Start typing address..."
                  @addressSelected="(addr) => handleGuarantorAddressSelected(index, addr)"
                />
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    v-model="guarantor.address.line2"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      v-model="guarantor.address.city"
                      type="text"
                      required
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                    <input
                      v-model="guarantor.address.postcode"
                      type="text"
                      required
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              v-if="formData.guarantors.length < 20"
              @click="addGuarantor"
              type="button"
              class="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
            >
              + Add Another Guarantor
            </button>
          </div>
        </div>

        <!-- Step 7: Review & Generate -->
        <div v-if="currentStep === 7">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Review & Generate</h3>
          <p class="text-sm text-gray-600 mb-6">Please review the information before generating the agreement</p>

          <div class="space-y-6">
            <!-- Template Type -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Agreement Template</h4>
              <p class="text-gray-700">{{ getTemplateLabel(formData.templateType) }}</p>
            </div>

            <!-- Property Address -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Property Address</h4>
              <p class="text-gray-700">
                {{ formData.propertyAddress.line1 }}<br />
                <span v-if="formData.propertyAddress.line2">{{ formData.propertyAddress.line2 }}<br /></span>
                {{ formData.propertyAddress.city }}<br />
                <span v-if="formData.propertyAddress.county">{{ formData.propertyAddress.county }}<br /></span>
                {{ formData.propertyAddress.postcode }}
              </p>
            </div>

            <!-- Landlords -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Landlords ({{ formData.landlords.length }})</h4>
              <div v-for="(landlord, index) in formData.landlords" :key="'review-landlord-' + index" class="mb-3">
                <p class="text-gray-700 font-medium">{{ index + 1 }}. {{ landlord.name }}</p>
                <p class="text-sm text-gray-600 ml-4">{{ formatAddress(landlord.address) }}</p>
              </div>
            </div>

            <!-- Tenants -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Tenants ({{ formData.tenants.length }})</h4>
              <div v-for="(tenant, index) in formData.tenants" :key="'review-tenant-' + index" class="mb-3">
                <p class="text-gray-700 font-medium">{{ index + 1 }}. {{ tenant.name }}</p>
                <p class="text-sm text-gray-600 ml-4">{{ formatAddress(tenant.address) }}</p>
              </div>
            </div>

            <!-- Guarantors -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Guarantors ({{ formData.guarantors.length }})</h4>
              <div v-if="formData.guarantors.length === 0">
                <p class="text-gray-500 italic">No guarantors</p>
              </div>
              <div v-else v-for="(guarantor, index) in formData.guarantors" :key="'review-guarantor-' + index" class="mb-3">
                <p class="text-gray-700 font-medium">{{ index + 1 }}. {{ guarantor.name }}</p>
                <p class="text-sm text-gray-600 ml-4">{{ formatAddress(guarantor.address) }}</p>
              </div>
            </div>

            <!-- Financial Details -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Financial Details</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-gray-600">Rent Amount</p>
                  <p class="text-gray-700 font-medium">£{{ formData.rentAmount || 0 }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">Deposit Amount</p>
                  <p class="text-gray-700 font-medium">£{{ formData.depositAmount || 0 }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">Rent Due Day</p>
                  <p class="text-gray-700 font-medium">{{ formData.rentDueDay }}</p>
                </div>
                <div v-if="formData.templateType !== 'no_deposit' && formData.templateType !== 'reposit'">
                  <p class="text-sm text-gray-600">Deposit Scheme Type</p>
                  <p class="text-gray-700 font-medium">{{ formData.depositSchemeType }}</p>
                </div>
              </div>
            </div>

            <!-- Tenancy Dates -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Tenancy Dates</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-gray-600">Start Date</p>
                  <p class="text-gray-700 font-medium">{{ formData.tenancyStartDate ? formatUkDate(formData.tenancyStartDate, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set' }}</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">Tenancy Term</p>
                  <p class="text-gray-700 font-medium">{{ formData.tenancyTerm }} months</p>
                </div>
                <div>
                  <p class="text-sm text-gray-600">End Date</p>
                  <p class="text-gray-700 font-medium">{{ displayEndDate }}</p>
                </div>
              </div>
            </div>

            <!-- Additional Details -->
            <div class="border-b pb-4">
              <h4 class="font-semibold text-gray-900 mb-2">Additional Details</h4>
              <div class="space-y-3">
                <div>
                  <p class="text-sm text-gray-600">Permitted Occupier(s)</p>
                  <p class="text-gray-700 font-medium">{{ formData.permittedOccupiers || 'None' }}</p>
                </div>
                <div v-if="formData.breakClauseEnabled && generatedBreakClause">
                  <p class="text-sm text-gray-600">Break Clause</p>
                  <p class="text-gray-700 font-medium">{{ generatedBreakClause }}</p>
                </div>
                <div v-if="formData.specialClauses">
                  <p class="text-sm text-gray-600">Special Clauses</p>
                  <p class="text-gray-700 font-medium whitespace-pre-wrap">{{ formData.specialClauses }}</p>
                </div>
              </div>
            </div>
          </div>

          <div v-if="error" class="mt-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {{ error }}
          </div>

          <div v-if="success" class="mt-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
            {{ success }}
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="mt-8 flex justify-between">
          <button
            v-if="currentStep > 0"
            @click="previousStep"
            type="button"
            class="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back
          </button>
          <div v-else></div>

          <button
            v-if="currentStep < steps.length - 1"
            @click="nextStep"
            :disabled="!canProceed"
            type="button"
            class="px-6 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
          <button
            v-else
            @click="generateAgreement"
            :disabled="loading"
            type="button"
            class="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Generating...</span>
            <span v-else>Generate Agreement</span>
          </button>
        </div>
      </div>

  </div>

  <!-- Agreement Payment Modal -->
  <AgreementPaymentModal
    v-if="showPaymentModal"
    :client-secret="paymentClientSecret"
    :price="agreementPrice"
    @close="showPaymentModal = false"
    @paid="handleAgreementPaid"
  />

  <!-- Compliance Override Modal -->
  <ComplianceOverrideModal
    :show="showComplianceOverrideModal"
    :property-address="selectedPropertyAddress"
    :expired-types="expiredComplianceTypes"
    @close="handleComplianceOverrideCancel"
    @confirm="handleComplianceOverrideConfirm"
  />

  <!-- Landlord Selector Modal -->
  <div
    v-if="showLandlordSelector"
    class="fixed inset-0 z-50 overflow-y-auto"
    aria-labelledby="modal-title"
    role="dialog"
    aria-modal="true"
    @click.self="showLandlordSelector = false"
  >
    <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

      <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

      <div
        class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full"
        @click.stop
      >
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-2xl font-bold text-gray-900">Select Landlord</h3>
            <button
              @click="showLandlordSelector = false"
              class="text-gray-400 hover:text-gray-500"
            >
              <X class="w-6 h-6" />
            </button>
          </div>

          <!-- Search -->
          <div class="mb-4">
            <input
              v-model="landlordSearchQuery"
              type="text"
              placeholder="Search landlords..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            />
          </div>

          <!-- Loading State -->
          <div v-if="loadingLandlords" class="text-center py-8 text-gray-600">
            Loading landlords...
          </div>

          <!-- Landlords List -->
          <div v-else class="max-h-96 overflow-y-auto">
            <div v-if="filteredLandlords.length === 0" class="text-center py-8 text-gray-500">
              No landlords found
            </div>
            <div
              v-for="landlord in filteredLandlords"
              :key="landlord.id"
              @click="selectLandlord(landlord)"
              class="p-4 border border-gray-200 rounded-lg mb-3 hover:bg-gray-50 cursor-pointer"
            >
              <div class="flex justify-between items-center">
                <div>
                  <div class="text-sm font-medium text-gray-900">
                    {{ landlord.first_name }} {{ landlord.last_name }}
                  </div>
                  <div class="text-sm text-gray-500">{{ landlord.email }}</div>
                  <div v-if="landlord.residential_address" class="text-xs text-gray-400 mt-1">
                    {{ landlord.residential_address.line1 }}, {{ landlord.residential_address.city }}, {{ landlord.residential_address.postcode }}
                  </div>
                </div>
                <button
                  @click.stop="selectLandlord(landlord)"
                  class="px-3 py-1 text-sm font-medium text-primary border border-primary rounded-md hover:bg-primary/5"
                >
                  Select
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'
import AgreementPaymentModal from '../components/AgreementPaymentModal.vue'
import { useAuthStore } from '../stores/auth'
import { formatDate as formatUkDate } from '../utils/date'
import { isValidEmail } from '../utils/validation'
import { Building, Check, FileText, Users, X } from 'lucide-vue-next'
import ComplianceOverrideModal from '../components/properties/ComplianceOverrideModal.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const steps = ['Import', 'Template', 'Property', 'Details', 'Landlords', 'Tenants', 'Guarantors', 'Review']
const currentStep = ref(0)
const loading = ref(false)
const error = ref('')
const success = ref('')

// Payment modal state
const showPaymentModal = ref(false)
const paymentClientSecret = ref('')
const agreementPrice = ref(9.99)
const pendingAgreementId = ref<string | null>(null)

// Reference import state
const availableReferences = ref<any[]>([])
const loadingReferences = ref(false)
const referenceSearchQuery = ref('')
const selectedReferenceId = ref<string | null>(null)
const importedFromReference = ref(false)
const showReferenceSelector = ref(false)

// Landlord selection state (for Step 4)
const availableLandlords = ref<any[]>([])
const loadingLandlords = ref(false)
const landlordSearchQuery = ref('')
const showLandlordSelector = ref(false)

// Landlord import state (for Step 0)
const availableLandlordsForImport = ref<any[]>([])
const loadingLandlordsImport = ref(false)
const landlordImportSearchQuery = ref('')
const showLandlordImportSelector = ref(false)
const selectedLandlordId = ref<string | null>(null)
const importedFromLandlord = ref(false)

// Property selection state (for Step 2)
const availableProperties = ref<any[]>([])
const loadingProperties = ref(false)
const propertySearchQuery = ref('')
const selectedPropertyId = ref<string | null>(null)
const propertyEntryMode = ref<'select' | 'manual'>('manual')
const showComplianceOverrideModal = ref(false)
const expiredComplianceTypes = ref<string[]>([])
const complianceOverrideReason = ref<string | null>(null)
const selectedPropertyAddress = ref('')

const templateOptions = [
  {
    value: 'dps',
    label: 'DPS (Deposit Protection Service)',
    description: 'For tenancies using the Deposit Protection Service (Custodial or Insured)'
  },
  {
    value: 'mydeposits',
    label: 'Mydeposits',
    description: 'For tenancies using the Mydeposits scheme (Custodial or Insured)'
  },
  {
    value: 'tds',
    label: 'TDS (Tenancy Deposit Scheme)',
    description: 'For tenancies using the Tenancy Deposit Scheme operated by The Dispute Service Ltd'
  },
  {
    value: 'reposit',
    label: 'Reposit',
    description: 'For tenancies using the Reposit deposit alternative scheme'
  },
  {
    value: 'no_deposit',
    label: 'No Deposit',
    description: 'For tenancies where no monetary deposit is taken'
  }
]

interface Address {
  line1: string
  line2?: string
  city: string
  county?: string
  postcode: string
}

interface Party {
  name: string
  email?: string
  address: Address
}

const formData = ref<{
  language: 'english' | 'welsh'
  templateType: string
  propertyAddress: Address
  rentAmount?: number
  depositAmount?: number
  tenancyStartDate?: string
  tenancyTerm: string | number
  tenancyEndDate?: string
  rentDueDay: string
  depositSchemeType: string
  permittedOccupiers?: string
  managementType: 'managed' | 'let_only'
  tenantEmail?: string
  landlordEmail?: string
  agentEmail?: string
  bankAccountName?: string
  bankAccountNumber?: string
  bankSortCode?: string
  breakClauseEnabled: boolean
  breakClauseMonths?: number | null
  breakClauseNoticePeriod?: number | null
  breakClause?: string
  specialClauses?: string
  landlords: Party[]
  tenants: Party[]
  guarantors: Party[]
}>({
  language: 'english',
  templateType: '',
  propertyAddress: {
    line1: '',
    line2: '',
    city: '',
    county: '',
    postcode: ''
  },
  rentAmount: undefined,
  depositAmount: undefined,
  tenancyStartDate: '',
  tenancyTerm: 12,
  tenancyEndDate: '',
  rentDueDay: '1st',
  depositSchemeType: '',
  permittedOccupiers: '',
  managementType: 'let_only',
  tenantEmail: '',
  landlordEmail: '',
  agentEmail: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankSortCode: '',
  breakClauseEnabled: false,
  breakClauseMonths: null,
  breakClauseNoticePeriod: null,
  breakClause: '',
  specialClauses: '',
  landlords: [
    {
      name: '',
      address: { line1: '', line2: '', city: '', county: '', postcode: '' }
    }
  ],
  tenants: [
    {
      name: '',
      address: { line1: '', line2: '', city: '', county: '', postcode: '' }
    }
  ],
  guarantors: []
})

// Fetch company settings on mount
onMounted(async () => {
  fetchCompanySettings()

  // Check if we should auto-import a reference from query params
  const referenceId = route.query.referenceId as string
  if (referenceId) {
    await selectReference(referenceId)
    // Skip to step 1 (Template selection) after successful import
    // Note: selectReference() already handles toast notifications
    currentStep.value = 1
  }
})

// Re-fetch when management type changes
watch(() => formData.value.managementType, () => {
  if (formData.value.managementType === 'managed') {
    fetchCompanySettings()
  }
})

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

// Update rent due date when tenancy start date changes
watch(() => formData.value.tenancyStartDate, (newDate) => {
  if (newDate) {
    const date = new Date(newDate)
    const day = date.getDate()
    const suffix = getOrdinalSuffix(day)
    formData.value.rentDueDay = `${day}${suffix}`
  }
})

// Auto-update tenancy end date when start date changes (if not manually edited)
watch(() => formData.value.tenancyStartDate, () => {
  if (!endDateManuallyEdited.value) {
    formData.value.tenancyEndDate = calculatedEndDate.value || ''
  }
})

// Auto-update tenancy end date when term changes (if not manually edited)
watch(() => formData.value.tenancyTerm, () => {
  if (!endDateManuallyEdited.value) {
    formData.value.tenancyEndDate = calculatedEndDate.value || ''
  }
})

// Track manual edits to end date field
watch(() => formData.value.tenancyEndDate, (newDate, oldDate) => {
  // If user changes end date value manually (not from our auto-calculation)
  if (newDate !== calculatedEndDate.value && newDate !== oldDate && oldDate !== undefined) {
    endDateManuallyEdited.value = true
  }
  // If user clears the end date or sets it back to calculated, reset the flag
  if (newDate === calculatedEndDate.value || newDate === '') {
    endDateManuallyEdited.value = false
  }
})

// Computed property to calculate end date from start date + term
// Returns ISO format (YYYY-MM-DD) for database storage
const calculatedEndDate = computed(() => {
  if (!formData.value.tenancyStartDate) {
    return null
  }

  const months = Number(formData.value.tenancyTerm)

  // 0 months means rolling tenancy
  if (isNaN(months) || months === 0) {
    return null // Send null for rolling tenancies
  }

  const startDate = new Date(formData.value.tenancyStartDate)
  startDate.setMonth(startDate.getMonth() + months)
  // Subtract 1 day to get the day before the anniversary (UK tenancy convention)
  startDate.setDate(startDate.getDate() - 1)
  // Return ISO format for database (YYYY-MM-DD)
  return startDate.toISOString().split('T')[0]
})

// Display-friendly end date for the review page
const displayEndDate = computed(() => {
  const endDate = formData.value.tenancyEndDate || calculatedEndDate.value
  if (!endDate) {
    return 'Rolling (month-to-month)'
  }
  return formatUkDate(endDate, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
})

// Display-friendly calculated end date (for showing what was auto-calculated)
const displayCalculatedEndDate = computed(() => {
  if (!calculatedEndDate.value) {
    return 'Rolling'
  }
  return formatUkDate(calculatedEndDate.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
})

// Track whether user has manually edited the end date
const endDateManuallyEdited = ref(false)

// Check if end date differs from calculated value
const isEndDateOverridden = computed(() => {
  if (!formData.value.tenancyEndDate || !calculatedEndDate.value) {
    return false
  }
  return formData.value.tenancyEndDate !== calculatedEndDate.value
})

// Computed property to calculate 5 weeks deposit from monthly rent
const calculatedDeposit = computed(() => {
  if (!formData.value.rentAmount || formData.value.rentAmount <= 0) {
    return null
  }
  // Formula: (monthly rent * 12 / 52) * 5 = 5 weeks rent
  const weeklyRent = (formData.value.rentAmount * 12) / 52
  const fiveWeeksDeposit = weeklyRent * 5
  // Round down to nearest whole pound
  return Math.floor(fiveWeeksDeposit)
})

// Track whether user has manually edited the deposit
const depositManuallyEdited = ref(false)

// Watch rent amount and auto-calculate deposit
watch(() => formData.value.rentAmount, (newRent) => {
  // Only auto-update if user hasn't manually edited the deposit
  if (!depositManuallyEdited.value && newRent && newRent > 0 && calculatedDeposit.value !== null) {
    formData.value.depositAmount = calculatedDeposit.value
  }
})

// Track manual edits to deposit field
watch(() => formData.value.depositAmount, (newDeposit, oldDeposit) => {
  // If user changes deposit value manually (not from our auto-calculation)
  if (newDeposit !== calculatedDeposit.value && newDeposit !== oldDeposit) {
    depositManuallyEdited.value = true
  }
})

// Generate formal legal text for break clause
const generatedBreakClause = computed(() => {
  if (!formData.value.breakClauseEnabled ||
      !formData.value.breakClauseMonths ||
      !formData.value.breakClauseNoticePeriod) {
    return ''
  }

  const months = formData.value.breakClauseMonths
  const notice = formData.value.breakClauseNoticePeriod

  return `Either party may terminate this tenancy by providing ${notice} month${notice > 1 ? 's' : ''}' written notice to the other party, which notice may be given at any time after the expiry of ${months} month${months > 1 ? 's' : ''} from the commencement of this tenancy.`
})

// Filter references by search query
const filteredReferences = computed(() => {
  let refs = availableReferences.value

  if (referenceSearchQuery.value) {
    const query = referenceSearchQuery.value.toLowerCase()
    refs = refs.filter((ref: any) => {
      const tenantName = `${ref.tenant_first_name || ''} ${ref.tenant_last_name || ''}`.toLowerCase()
      const propertyAddress = `${ref.property_address || ''} ${ref.property_city || ''} ${ref.property_postcode || ''}`.toLowerCase()
      return tenantName.includes(query) || propertyAddress.includes(query)
    })
  }

  // Sort: group parents (full properties) first, then by created_at
  return [...refs].sort((a, b) => {
    // Group parents first
    if (a.is_group_parent && !b.is_group_parent) return -1
    if (!a.is_group_parent && b.is_group_parent) return 1
    // Then by created_at descending
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
})

// Filter landlords for import by search query
const filteredLandlordsForImport = computed(() => {
  if (!landlordImportSearchQuery.value) return availableLandlordsForImport.value

  const query = landlordImportSearchQuery.value.toLowerCase()
  return availableLandlordsForImport.value.filter((landlord: any) => {
    const name = `${landlord.first_name} ${landlord.last_name}`.toLowerCase()
    const email = (landlord.email || '').toLowerCase()
    return name.includes(query) || email.includes(query)
  })
})

// Filter landlords by search query
const filteredLandlords = computed(() => {
  if (!landlordSearchQuery.value) return availableLandlords.value

  const query = landlordSearchQuery.value.toLowerCase()
  return availableLandlords.value.filter((landlord: any) => {
    const fullName = `${landlord.first_name || ''} ${landlord.last_name || ''}`.toLowerCase()
    const email = (landlord.email || '').toLowerCase()
    return fullName.includes(query) || email.includes(query)
  })
})

// Watch for landlord selector modal to open and fetch landlords
watch(() => showLandlordSelector.value, (isOpen) => {
  if (isOpen && availableLandlords.value.length === 0) {
    fetchLandlords()
  }
})

// Fetch landlords
async function fetchLandlords() {
  loadingLandlords.value = true
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    if (!token) return

    const response = await fetch(`${API_URL}/api/landlords`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch landlords')
    }

    const data = await response.json()
    availableLandlords.value = data.landlords || []
  } catch (err) {
    console.error('Error fetching landlords:', err)
    toast.error('Failed to load landlords')
  } finally {
    loadingLandlords.value = false
  }
}

// Select landlord and add to form
function selectLandlord(landlord: any) {
  // Check if landlord already exists
  const existingIndex = formData.value.landlords.findIndex(
    (l: any) => l.name === `${landlord.first_name} ${landlord.last_name}`
  )

  if (existingIndex >= 0) {
    // Update existing landlord
    formData.value.landlords[existingIndex] = {
      name: landlord.full_name_displayed_on_contracts || `${landlord.first_name} ${landlord.last_name}`,
      address: {
        line1: landlord.residential_address?.line1 || '',
        line2: landlord.residential_address?.line2 || '',
        city: landlord.residential_address?.city || '',
        county: landlord.residential_address?.county || '',
        postcode: landlord.residential_address?.postcode || ''
      }
    }
  } else {
    // Add new landlord if under limit
    if (formData.value.landlords.length < 20) {
      formData.value.landlords.push({
        name: landlord.full_name_displayed_on_contracts || `${landlord.first_name} ${landlord.last_name}`,
        address: {
          line1: landlord.residential_address?.line1 || '',
          line2: landlord.residential_address?.line2 || '',
          city: landlord.residential_address?.city || '',
          county: landlord.residential_address?.county || '',
          postcode: landlord.residential_address?.postcode || ''
        }
      })
    } else {
      toast.error('Maximum of 20 landlords allowed')
      return
    }
  }

  // Set landlord email if not already set
  if (!formData.value.landlordEmail && landlord.email) {
    formData.value.landlordEmail = landlord.email
  }

  showLandlordSelector.value = false
  toast.success('Landlord added successfully')
}

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0: // Import from reference (always can proceed - it's optional)
      return true
    case 1: // Template selection
      const templateSelected = formData.value.templateType !== ''
      const needsSchemeType = formData.value.templateType !== 'no_deposit' && formData.value.templateType !== 'reposit'
      const schemeTypeValid = !needsSchemeType || formData.value.depositSchemeType !== ''
      return templateSelected && schemeTypeValid
    case 2: // Property address
      return (
        formData.value.propertyAddress.line1 !== '' &&
        formData.value.propertyAddress.city !== '' &&
        formData.value.propertyAddress.postcode !== ''
      )
    case 3: // Agreement details
      // depositSchemeType only required for standard deposit templates
      const needsDepositScheme = formData.value.templateType !== 'no_deposit' && formData.value.templateType !== 'reposit'
      const depositSchemeValid = !needsDepositScheme || formData.value.depositSchemeType !== ''
      const baseValid = (
        formData.value.rentAmount !== undefined && formData.value.rentAmount > 0 &&
        formData.value.depositAmount !== undefined && formData.value.depositAmount >= 0 &&
        formData.value.tenancyStartDate !== '' &&
        formData.value.tenancyTerm !== undefined && formData.value.tenancyTerm !== '' && !isNaN(Number(formData.value.tenancyTerm)) &&
        formData.value.rentDueDay !== '' &&
        depositSchemeValid &&
        (formData.value.managementType === 'managed' || formData.value.managementType === 'let_only') &&
        formData.value.tenantEmail !== ''
      )

      // If break clause enabled, require both fields
      const breakClauseValid = !formData.value.breakClauseEnabled || (
        formData.value.breakClauseMonths !== null &&
        formData.value.breakClauseMonths !== undefined &&
        formData.value.breakClauseMonths > 0 &&
        formData.value.breakClauseNoticePeriod !== null &&
        formData.value.breakClauseNoticePeriod !== undefined &&
        formData.value.breakClauseNoticePeriod > 0
      )

      // If let_only, also require landlord email and bank details
      if (formData.value.managementType === 'let_only') {
        return baseValid &&
          breakClauseValid &&
          formData.value.landlordEmail !== '' &&
          formData.value.bankAccountName !== '' &&
          formData.value.bankAccountNumber !== '' &&
          formData.value.bankSortCode !== ''
      }

      return baseValid && breakClauseValid
    case 4: // Landlords
      return formData.value.landlords.every(
        (l) => l.name !== '' && l.address.line1 !== '' && l.address.city !== '' && l.address.postcode !== ''
      )
    case 5: // Tenants
      return formData.value.tenants.every(
        (t) => t.name !== '' && t.address.line1 !== '' && t.address.city !== '' && t.address.postcode !== ''
      )
    case 6: // Guarantors (optional, so always can proceed)
      if (formData.value.guarantors.length === 0) return true
      return formData.value.guarantors.every(
        (g) => g.name !== '' && g.address.line1 !== '' && g.address.city !== '' && g.address.postcode !== ''
      )
    default:
      return true
  }
})

function nextStep() {
  // Validate emails before proceeding from step 3 (Agreement details)
  if (currentStep.value === 3) {
    if (formData.value.tenantEmail && !isValidEmail(formData.value.tenantEmail)) {
      toast.error('Please enter a valid tenant email address')
      return
    }
    if (formData.value.managementType === 'let_only' && formData.value.landlordEmail && !isValidEmail(formData.value.landlordEmail)) {
      toast.error('Please enter a valid landlord email address')
      return
    }
  }

  if (canProceed.value && currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

function previousStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function addLandlord() {
  if (formData.value.landlords.length < 20) {
    formData.value.landlords.push({
      name: '',
      address: { line1: '', line2: '', city: '', county: '', postcode: '' }
    })
  }
}

function removeLandlord(index: number) {
  formData.value.landlords.splice(index, 1)
}

function addTenant() {
  if (formData.value.tenants.length < 20) {
    formData.value.tenants.push({
      name: '',
      address: { line1: '', line2: '', city: '', county: '', postcode: '' }
    })
  }
}

function removeTenant(index: number) {
  formData.value.tenants.splice(index, 1)
}

function addGuarantor() {
  if (formData.value.guarantors.length < 20) {
    formData.value.guarantors.push({
      name: '',
      email: '',
      address: { line1: '', line2: '', city: '', county: '', postcode: '' }
    })
  }
}

function removeGuarantor(index: number) {
  formData.value.guarantors.splice(index, 1)
}

function getTemplateLabel(value: string): string {
  const template = templateOptions.find((t) => t.value === value)
  return template ? template.label : value
}

function formatAddress(address: Address): string {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.county,
    address.postcode
  ].filter(Boolean)
  return parts.join(', ')
}

// Address autocomplete handlers
function handlePropertyAddressSelected(addr: any) {
  formData.value.propertyAddress.line1 = addr.addressLine1
  formData.value.propertyAddress.city = addr.city
  formData.value.propertyAddress.postcode = addr.postcode
}

function handleLandlordAddressSelected(index: number, addr: any) {
  if (formData.value.landlords[index]) {
    formData.value.landlords[index].address.line1 = addr.addressLine1
    formData.value.landlords[index].address.city = addr.city
    formData.value.landlords[index].address.postcode = addr.postcode
  }
}

function handleTenantAddressSelected(index: number, addr: any) {
  if (formData.value.tenants[index]) {
    formData.value.tenants[index].address.line1 = addr.addressLine1
    formData.value.tenants[index].address.city = addr.city
    formData.value.tenants[index].address.postcode = addr.postcode
  }
}

function handleGuarantorAddressSelected(index: number, addr: any) {
  if (formData.value.guarantors[index]) {
    formData.value.guarantors[index].address.line1 = addr.addressLine1
    formData.value.guarantors[index].address.city = addr.city
    formData.value.guarantors[index].address.postcode = addr.postcode
  }
}

// Fetch parent references for import selection
async function fetchParentReferences() {
  loadingReferences.value = true
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    if (!token) return

    const response = await fetch(`${API_URL}/api/references`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const { references } = await response.json()
      // Filter out guarantors only - include both single tenant refs and multi-tenant child refs
      availableReferences.value = references.filter((ref: any) => !ref.is_guarantor)
    }
  } catch (err) {
    console.error('Error fetching references:', err)
    toast.error('Failed to load references')
  } finally {
    loadingReferences.value = false
  }
}

// Toggle reference selector
function toggleReferenceSelector() {
  showReferenceSelector.value = !showReferenceSelector.value
  // Don't close landlord selector - allow both to be open
  if (showReferenceSelector.value && availableReferences.value.length === 0) {
    fetchParentReferences()
  }
}

// Toggle landlord import selector
function toggleLandlordImportSelector() {
  showLandlordImportSelector.value = !showLandlordImportSelector.value
  // Don't close reference selector - allow both to be open
  if (showLandlordImportSelector.value && availableLandlordsForImport.value.length === 0) {
    fetchLandlordsForImport()
  }
}

// Close all import selectors
function closeAllImportSelectors() {
  showReferenceSelector.value = false
  showLandlordImportSelector.value = false
}

// Fetch landlords for import
async function fetchLandlordsForImport() {
  loadingLandlordsImport.value = true
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    if (!token) return

    const response = await fetch(`${API_URL}/api/landlords`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch landlords')
    }

    const data = await response.json()
    availableLandlordsForImport.value = data.landlords || []
  } catch (err) {
    console.error('Error fetching landlords:', err)
    toast.error('Failed to load landlords')
  } finally {
    loadingLandlordsImport.value = false
  }
}

// Select landlord for import and auto-fill form
async function selectLandlordForImport(landlord: any) {
  selectedLandlordId.value = landlord.id
  importedFromLandlord.value = true

  // Fetch full landlord details to get address
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const token = authStore.session?.access_token

  let fullLandlord = landlord
  if (token) {
    try {
      const response = await fetch(`${API_URL}/api/landlords/${landlord.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        fullLandlord = data.landlord || landlord
      }
    } catch (err) {
      console.error('Error fetching landlord details:', err)
    }
  }

  // Auto-fill landlord email (Step 3)
  if (fullLandlord.email) {
    formData.value.landlordEmail = fullLandlord.email
  }

  // Auto-fill bank details (Step 3)
  if (fullLandlord.bank_details) {
    if (fullLandlord.bank_details.account_number) {
      formData.value.bankAccountNumber = fullLandlord.bank_details.account_number
    }
    if (fullLandlord.bank_details.sort_code) {
      formData.value.bankSortCode = fullLandlord.bank_details.sort_code
    }
  }

  // Add landlord to landlords array (Step 4)
  const landlordName = fullLandlord.full_name_displayed_on_contracts || `${fullLandlord.first_name} ${fullLandlord.last_name}`
  const landlordData = {
    name: landlordName,
    address: {
      line1: fullLandlord.residential_address?.line1 || '',
      line2: fullLandlord.residential_address?.line2 || '',
      city: fullLandlord.residential_address?.city || '',
      county: fullLandlord.residential_address?.county || '',
      postcode: fullLandlord.residential_address?.postcode || ''
    }
  }

  const existingIndex = formData.value.landlords.findIndex(
    (l: any) => l.name === landlordName
  )

  if (existingIndex >= 0) {
    // Update existing
    formData.value.landlords[existingIndex] = landlordData
  } else {
    // Check if first landlord is blank and should be replaced
    const firstLandlord = formData.value.landlords[0]
    const isFirstBlank = formData.value.landlords.length === 1 &&
      !firstLandlord?.name &&
      !firstLandlord?.address?.line1

    if (isFirstBlank) {
      // Replace the blank placeholder
      formData.value.landlords[0] = landlordData
    } else {
      // Add new
      formData.value.landlords.push(landlordData)
    }
  }

  // Auto-collapse the landlord selector after selection
  showLandlordImportSelector.value = false

  toast.success('Landlord details imported successfully')
}

// Clear landlord import
function clearLandlordImport() {
  selectedLandlordId.value = null
  importedFromLandlord.value = false
  // Don't clear form data as user might want to keep it
}

// Fetch properties for selection (Step 2)
async function fetchProperties() {
  loadingProperties.value = true
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    if (!token) return

    const searchParam = propertySearchQuery.value ? `?search=${encodeURIComponent(propertySearchQuery.value)}` : ''
    const response = await fetch(`${API_URL}/api/properties${searchParam}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
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

// Get display address for a property
function getPropertyDisplayAddress(property: any) {
  const parts = [
    property.address_line1,
    property.address_line2,
    property.city,
    property.postcode
  ].filter(Boolean)
  return parts.join(', ')
}

// Select a property and check compliance
async function selectProperty(property: any) {
  selectedPropertyId.value = property.id
  selectedPropertyAddress.value = getPropertyDisplayAddress(property)

  // Auto-fill the property address
  formData.value.propertyAddress = {
    line1: property.address_line1 || '',
    line2: property.address_line2 || '',
    city: property.city || '',
    county: property.county || '',
    postcode: property.postcode || ''
  }

  // Check compliance status
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    const response = await fetch(`${API_URL}/api/properties/${property.id}/compliance`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const { compliance } = await response.json()
      const expired = compliance?.filter((r: any) => r.status === 'expired') || []

      if (expired.length > 0) {
        expiredComplianceTypes.value = expired.map((r: any) => r.compliance_type)
        showComplianceOverrideModal.value = true
      } else {
        // No expired compliance - clear any previous override
        expiredComplianceTypes.value = []
        complianceOverrideReason.value = null
        toast.success('Property selected successfully')
      }
    }
  } catch (err) {
    console.error('Error checking compliance:', err)
    // Allow proceeding even if compliance check fails
    toast.warning('Could not verify compliance status')
  }
}

// Handle compliance override confirmation
function handleComplianceOverrideConfirm(reason: string) {
  complianceOverrideReason.value = reason
  showComplianceOverrideModal.value = false
  toast.success('Property selected with compliance override')
}

// Handle compliance override cancel
function handleComplianceOverrideCancel() {
  showComplianceOverrideModal.value = false
  // Clear property selection
  selectedPropertyId.value = null
  selectedPropertyAddress.value = ''
  formData.value.propertyAddress = {
    line1: '',
    line2: '',
    city: '',
    county: '',
    postcode: ''
  }
  expiredComplianceTypes.value = []
}

// Clear property selection
function clearPropertySelection() {
  selectedPropertyId.value = null
  selectedPropertyAddress.value = ''
  complianceOverrideReason.value = null
  expiredComplianceTypes.value = []
  formData.value.propertyAddress = {
    line1: '',
    line2: '',
    city: '',
    county: '',
    postcode: ''
  }
  propertyEntryMode.value = 'manual'
}

// Helper function to get ordinal suffix for rent due day
function getOrdinalSuffixForDay(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

// Select a reference and load its full data
async function selectReference(referenceId: string) {
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    if (!token) return

    // Fetch full reference data
    const response = await fetch(`${API_URL}/api/references/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch reference details')
    }

    const data = await response.json()
    const { reference, childReferences, guarantorReferences, landlordReference } = data

    // Mark as selected
    selectedReferenceId.value = referenceId
    importedFromReference.value = true

    // Map reference data to form
    mapReferenceToForm(reference, childReferences, guarantorReferences, landlordReference)

    // Auto-collapse the reference selector after selection
    showReferenceSelector.value = false

    toast.success('Reference data imported successfully!')
  } catch (err) {
    console.error('Error selecting reference:', err)
    toast.error('Failed to import reference data')
  }
}

// Map reference data to agreement form
// Note: landlordReference parameter is intentionally unused - it contains the tenant's
// PREVIOUS landlord (reference provider), not the new property's landlord
function mapReferenceToForm(
  reference: any,
  childReferences: any[] = [],
  guarantorReferences: any[] = [],
  _landlordReference: any = null
) {
  // Property address - use reference address, or first child's address for group parents
  const addressSource = reference.property_address
    ? reference
    : (childReferences && childReferences.length > 0 ? childReferences[0] : null)

  if (addressSource?.property_address) {
    formData.value.propertyAddress = {
      line1: addressSource.property_address,
      line2: '',
      city: addressSource.property_city || '',
      county: '',
      postcode: addressSource.property_postcode || ''
    }
  }

  // Use first child as fallback data source for group parents
  const dataSource = childReferences && childReferences.length > 0 ? childReferences[0] : reference

  // Financial details
  const monthlyRent = reference.monthly_rent || dataSource.monthly_rent
  if (monthlyRent) {
    formData.value.rentAmount = parseFloat(monthlyRent)
    // Auto-calculate deposit as 5 weeks rent (rounded down to nearest pound)
    const weeklyRent = (formData.value.rentAmount * 12) / 52
    const fiveWeeksDeposit = weeklyRent * 5
    formData.value.depositAmount = Math.floor(fiveWeeksDeposit)
    // Reset manual edit flag since this is auto-imported
    depositManuallyEdited.value = false
  }

  // Tenancy dates
  const moveInDate = reference.move_in_date || dataSource.move_in_date
  if (moveInDate) {
    formData.value.tenancyStartDate = moveInDate

    // Auto-set rent due day from move-in date
    const moveInDateObj = new Date(moveInDate)
    const day = moveInDateObj.getDate()
    const suffix = getOrdinalSuffixForDay(day)
    formData.value.rentDueDay = `${day}${suffix}`
  }

  // Tenancy term (convert years + months to total months)
  const termYears = reference.term_years ?? dataSource.term_years
  const termMonths = reference.term_months ?? dataSource.term_months
  if (termYears !== undefined && termMonths !== undefined) {
    formData.value.tenancyTerm = (termYears * 12) + termMonths
  }

  // Tenant email (use first child for group parents)
  const tenantEmail = reference.tenant_email || dataSource.tenant_email
  if (tenantEmail) {
    formData.value.tenantEmail = tenantEmail
  }

  // Build tenants array
  if (reference.is_group_parent && childReferences && childReferences.length > 0) {
    // Multi-tenant scenario
    formData.value.tenants = childReferences.map((child: any) => ({
      name: `${child.tenant_first_name} ${child.tenant_last_name}`,
      address: {
        line1: child.property_address || '',
        line2: '',
        city: child.property_city || '',
        county: '',
        postcode: child.property_postcode || ''
      }
    }))
  } else {
    // Single tenant
    formData.value.tenants = [{
      name: `${reference.tenant_first_name} ${reference.tenant_last_name}`,
      address: {
        line1: reference.property_address || '',
        line2: '',
        city: reference.property_city || '',
        county: '',
        postcode: reference.property_postcode || ''
      }
    }]
  }

  // Build guarantors array - collect from both childReferences (for group parents) and top-level guarantorReferences
  const allGuarantors: any[] = []

  // Extract guarantors from childReferences (for group parent / multi-tenant references)
  if (childReferences && childReferences.length > 0) {
    childReferences.forEach((child: any) => {
      if (child.guarantors && child.guarantors.length > 0) {
        child.guarantors.forEach((g: any) => {
          allGuarantors.push({
            name: `${g.tenant_first_name} ${g.tenant_last_name}`,
            email: g.tenant_email || g.email || '',
            address: {
              line1: g.current_address || g.property_address || '',
              line2: '',
              city: g.current_city || g.property_city || '',
              county: '',
              postcode: g.current_postcode || g.property_postcode || ''
            }
          })
        })
      }
    })
  }

  // Also include top-level guarantorReferences (for single tenant references)
  if (guarantorReferences && guarantorReferences.length > 0) {
    guarantorReferences.forEach((g: any) => {
      allGuarantors.push({
        name: `${g.tenant_first_name} ${g.tenant_last_name}`,
        email: g.tenant_email || g.email || '',
        address: {
          line1: g.current_address || g.property_address || '',
          line2: '',
          city: g.current_city || g.property_city || '',
          county: '',
          postcode: g.current_postcode || g.property_postcode || ''
        }
      })
    })
  }

  formData.value.guarantors = allGuarantors

  // NOTE: Landlord data is NOT autofilled from landlordReference because that contains
  // the tenant's PREVIOUS landlord (who provided a reference), not the new property's landlord.
  // Landlord details should only be populated when explicitly imported from the landlords database.
}

// Clear imported reference data
function clearImport() {
  selectedReferenceId.value = null
  importedFromReference.value = false
  showReferenceSelector.value = false

  // Reset form to defaults (but keep any manually entered data)
  // User can manually edit if they want to start fresh
  toast.info('Import cleared. Form data retained.')
}

// Fetch company settings for managed properties
async function fetchCompanySettings() {
  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    const response = await fetch(`${API_URL}/api/company/settings`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const { company } = await response.json()
      // Populate agent email and bank details if managed
      if (formData.value.managementType === 'managed' && company) {
        formData.value.agentEmail = company.email || ''
        formData.value.bankAccountName = company.bank_account_name || ''
        formData.value.bankAccountNumber = company.bank_account_number || ''
        formData.value.bankSortCode = company.bank_sort_code || ''
      }
    }
  } catch (err) {
    console.error('Error fetching company settings:', err)
  }
}

async function generateAgreement() {
  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    if (!token) {
      throw new Error('You must be logged in to generate an agreement')
    }

    // Create the agreement with end date (user-edited or calculated) and generated break clause
    const agreementData: Record<string, any> = {
      ...formData.value,
      tenancyEndDate: formData.value.tenancyEndDate || calculatedEndDate.value || null,
      breakClause: formData.value.breakClauseEnabled ? generatedBreakClause.value : ''
    }

    // Add property integration if a property was selected
    if (selectedPropertyId.value) {
      agreementData.propertyId = selectedPropertyId.value
      if (complianceOverrideReason.value) {
        agreementData.complianceOverride = {
          acknowledged: true,
          reason: complianceOverrideReason.value
        }
      }
    }

    const createResponse = await fetch(`${API_URL}/api/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(agreementData)
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json()

      // Handle compliance override required error
      if (errorData.requiresComplianceOverride && errorData.expiredComplianceTypes) {
        expiredComplianceTypes.value = errorData.expiredComplianceTypes
        showComplianceOverrideModal.value = true
        throw new Error('Please acknowledge the expired compliance to proceed')
      }

      throw new Error(errorData.error || 'Failed to create agreement')
    }

    const { agreement } = await createResponse.json()

    // Generate the DOCX file - this may require payment
    const generateResponse = await fetch(`${API_URL}/api/agreements/${agreement.id}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })

    const generateData = await generateResponse.json()

    // Check if insufficient credits
    if (generateResponse.status === 402 && generateData.requires_credits) {
      throw new Error(generateData.message || 'Insufficient credits to generate agreement')
    }

    // Check if payment is required
    if (generateResponse.status === 402 && generateData.requires_payment_method && generateData.client_secret) {
      // Payment method required - show payment modal
      pendingAgreementId.value = agreement.id
      paymentClientSecret.value = generateData.client_secret
      agreementPrice.value = generateData.amount || 9.99
      showPaymentModal.value = true
      loading.value = false
      return
    }

    if (!generateResponse.ok) {
      throw new Error(generateData.error || 'Failed to generate agreement file')
    }

    const { agreementId } = generateData

    success.value = 'Agreement generated successfully!'
    toast.success('Agreement generated! Redirecting to preview...')

    // Redirect to preview page
    setTimeout(() => {
      router.push(`/agreements/${agreementId || agreement.id}/preview`)
    }, 1000)
  } catch (err: any) {
    console.error('Error generating agreement:', err)
    error.value = err.message || 'Failed to generate agreement'
    toast.error(err.message || 'Failed to generate agreement')
  } finally {
    loading.value = false
  }
}

// Handle successful payment for agreement
async function handleAgreementPaid() {
  if (!pendingAgreementId.value) return

  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const token = authStore.session?.access_token

    toast.info('Payment successful! Generating your agreement...')

    // Retry generating the agreement after payment
    const generateResponse = await fetch(`${API_URL}/api/agreements/${pendingAgreementId.value}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })

    if (!generateResponse.ok) {
      const errorData = await generateResponse.json()
      throw new Error(errorData.error || errorData.message || 'Failed to generate agreement file')
    }

    const { agreementId } = await generateResponse.json()

    success.value = 'Agreement generated successfully!'
    toast.success('Agreement generated! Redirecting to preview...')

    // Redirect to preview page
    const previewId = agreementId || pendingAgreementId.value

    // Clear pending agreement before redirecting
    pendingAgreementId.value = null

    setTimeout(() => {
      router.push(`/agreements/${previewId}/preview`)
    }, 1000)
  } catch (err: any) {
    console.error('Error generating agreement after payment:', err)
    error.value = err.message || 'Failed to generate agreement'
    toast.error(err.message || 'Failed to generate agreement')
  }
}
</script>

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
                  <svg v-if="currentStep > index" class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
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
          <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
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

      <!-- Form Container -->
      <div class="bg-white rounded-lg shadow p-6">
        <!-- Step 0: Import from Reference -->
        <div v-if="currentStep === 0">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Import from Reference (Optional)</h3>
          <p class="text-sm text-gray-600 mb-6">Pre-fill this agreement with data from a completed reference, or skip to enter manually</p>

          <!-- Toggle Button -->
          <div class="mb-6">
            <button
              @click="toggleReferenceSelector"
              type="button"
              class="px-6 py-3 text-sm font-medium rounded-md transition-colors"
              :class="showReferenceSelector
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-primary text-white hover:bg-primary/90'
              "
            >
              {{ showReferenceSelector ? 'Skip - Enter Manually' : 'Import from Reference' }}
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
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
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
        </div>

        <!-- Step 1: Select Template -->
        <div v-if="currentStep === 1">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Select Agreement Template</h3>
          <p class="text-sm text-gray-600 mb-6">Choose the deposit protection scheme for this tenancy</p>

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
        </div>

        <!-- Step 2: Property Address -->
        <div v-if="currentStep === 2">
          <h3 class="text-xl font-semibold text-gray-900 mb-4">Property Address</h3>
          <div class="space-y-4 max-w-2xl">
            <AddressAutocomplete
              v-model="formData.propertyAddress.line1"
              label="Property Address"
              :required="true"
              placeholder="Start typing the property address..."
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

            <div v-if="formData.templateType !== 'no_deposit' && formData.templateType !== 'reposit'">
              <label class="block text-sm font-medium text-gray-700 mb-1">Deposit Scheme Type *</label>
              <select
                v-model="formData.depositSchemeType"
                :required="formData.templateType !== 'no_deposit' && formData.templateType !== 'reposit'"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="Custodial">Custodial Scheme</option>
                <option value="Insured">Insured Scheme</option>
              </select>
              <p class="text-xs text-gray-500 mt-1">Custodial: Deposit held by scheme. Insured: You hold deposit as stakeholder.</p>
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
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
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
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'
import AgreementPaymentModal from '../components/AgreementPaymentModal.vue'
import { useAuthStore } from '../stores/auth'
import { formatDate as formatUkDate } from '../utils/date'
import { isValidEmail } from '../utils/validation'

const route = useRoute()
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

// Landlord selection state
const availableLandlords = ref<any[]>([])
const loadingLandlords = ref(false)
const landlordSearchQuery = ref('')
const showLandlordSelector = ref(false)

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
  address: Address
}

const formData = ref<{
  templateType: string
  propertyAddress: Address
  rentAmount?: number
  depositAmount?: number
  tenancyStartDate?: string
  tenancyTerm: string | number
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
  rentDueDay: '1st',
  depositSchemeType: 'Custodial',
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
  if (!calculatedEndDate.value) {
    return 'Rolling (month-to-month)'
  }
  return formatUkDate(calculatedEndDate.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
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
  if (!referenceSearchQuery.value) return availableReferences.value

  const query = referenceSearchQuery.value.toLowerCase()
  return availableReferences.value.filter((ref: any) => {
    const tenantName = `${ref.tenant_first_name} ${ref.tenant_last_name}`.toLowerCase()
    const propertyAddress = `${ref.property_address} ${ref.property_city}`.toLowerCase()
    return tenantName.includes(query) || propertyAddress.includes(query)
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
      return formData.value.templateType !== ''
    case 2: // Property address
      return (
        formData.value.propertyAddress.line1 !== '' &&
        formData.value.propertyAddress.city !== '' &&
        formData.value.propertyAddress.postcode !== ''
      )
    case 3: // Agreement details
      const baseValid = (
        formData.value.rentAmount !== undefined && formData.value.rentAmount > 0 &&
        formData.value.depositAmount !== undefined && formData.value.depositAmount >= 0 &&
        formData.value.tenancyStartDate !== '' &&
        formData.value.tenancyTerm !== '' &&
        formData.value.rentDueDay !== '' &&
        formData.value.depositSchemeType !== '' &&
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
      // Filter for parent references only (not guarantors, not children)
      availableReferences.value = references.filter((ref: any) =>
        !ref.is_guarantor && !ref.parent_reference_id
      )
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
  if (showReferenceSelector.value && availableReferences.value.length === 0) {
    fetchParentReferences()
  }
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

    toast.success('Reference data imported successfully!')
  } catch (err) {
    console.error('Error selecting reference:', err)
    toast.error('Failed to import reference data')
  }
}

// Map reference data to agreement form
function mapReferenceToForm(
  reference: any,
  childReferences: any[] = [],
  guarantorReferences: any[] = [],
  landlordReference: any = null
) {
  // Property address
  if (reference.property_address) {
    formData.value.propertyAddress = {
      line1: reference.property_address,
      line2: '',
      city: reference.property_city || '',
      county: '',
      postcode: reference.property_postcode || ''
    }
  }

  // Financial details
  if (reference.monthly_rent) {
    formData.value.rentAmount = parseFloat(reference.monthly_rent)
    // Auto-calculate deposit as 5 weeks rent (rounded down to nearest pound)
    const weeklyRent = (formData.value.rentAmount * 12) / 52
    const fiveWeeksDeposit = weeklyRent * 5
    formData.value.depositAmount = Math.floor(fiveWeeksDeposit)
    // Reset manual edit flag since this is auto-imported
    depositManuallyEdited.value = false
  }

  // Tenancy dates
  if (reference.move_in_date) {
    formData.value.tenancyStartDate = reference.move_in_date

    // Auto-set rent due day from move-in date
    const moveInDate = new Date(reference.move_in_date)
    const day = moveInDate.getDate()
    const suffix = getOrdinalSuffixForDay(day)
    formData.value.rentDueDay = `${day}${suffix}`
  }

  // Tenancy term (convert years + months to total months)
  if (reference.term_years !== undefined && reference.term_months !== undefined) {
    formData.value.tenancyTerm = (reference.term_years * 12) + reference.term_months
  }

  // Tenant email
  if (reference.tenant_email) {
    formData.value.tenantEmail = reference.tenant_email
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

  // Build guarantors array
  if (guarantorReferences && guarantorReferences.length > 0) {
    formData.value.guarantors = guarantorReferences.map((g: any) => ({
      name: `${g.tenant_first_name} ${g.tenant_last_name}`,
      address: {
        line1: g.property_address || '',
        line2: '',
        city: g.property_city || '',
        county: '',
        postcode: g.property_postcode || ''
      }
    }))
  } else {
    formData.value.guarantors = []
  }

  // Landlord data if available
  if (landlordReference) {
    formData.value.landlords = [{
      name: landlordReference.landlord_name || '',
      address: {
        line1: landlordReference.property_address || '',
        line2: '',
        city: landlordReference.property_city || '',
        county: '',
        postcode: landlordReference.property_postcode || ''
      }
    }]
  }
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

    // Create the agreement with calculated end date and generated break clause
    const agreementData = {
      ...formData.value,
      tenancyEndDate: calculatedEndDate.value,
      breakClause: formData.value.breakClauseEnabled ? generatedBreakClause.value : ''
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

    const { fileUrl } = generateData

    success.value = 'Agreement generated successfully!'
    toast.success('Agreement generated successfully!')

    // Download the file
    setTimeout(() => {
      window.open(fileUrl, '_blank')
    }, 1500)
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

    const { fileUrl } = await generateResponse.json()

    success.value = 'Agreement generated successfully!'
    toast.success('Agreement generated successfully!')

    // Download the file
    setTimeout(() => {
      window.open(fileUrl, '_blank')
    }, 1000)

    // Clear pending agreement
    pendingAgreementId.value = null
  } catch (err: any) {
    console.error('Error generating agreement after payment:', err)
    error.value = err.message || 'Failed to generate agreement'
    toast.error(err.message || 'Failed to generate agreement')
  }
}
</script>
